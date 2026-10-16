import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MEMBERSHIP_COMMAND_SERVICE } from '../../../domain/services/membership-command.service.js';
import type { MembershipCommandService } from '../../../domain/services/membership-command.service.js';
import { MEMBERSHIP_QUERY_SERVICE } from '../../../domain/services/membership-query.service.js';
import type { MembershipQueryService } from '../../../domain/services/membership-query.service.js';
import { ActivateMembershipCommand } from '../../../domain/model/commands/activate-membership.command.js';
import { AssignCommunityRoleCommand } from '../../../domain/model/commands/assign-community-role.command.js';
import { AssignUnitCommand } from '../../../domain/model/commands/assign-unit.command.js';
import { ClearDelinquencyCommand } from '../../../domain/model/commands/clear-delinquency.command.js';
import { JudgeEligibilityCommand } from '../../../domain/model/commands/judge-eligibility.command.js';
import { MarkDelinquentCommand } from '../../../domain/model/commands/mark-delinquent.command.js';
import { ReinstateMembershipCommand } from '../../../domain/model/commands/reinstate-membership.command.js';
import { SuspendMembershipCommand } from '../../../domain/model/commands/suspend-membership.command.js';
import { TerminateMembershipCommand } from '../../../domain/model/commands/terminate-membership.command.js';
import { GetMembershipByIdQuery } from '../../../domain/model/queries/get-membership-by-id.query.js';
import { GetMembershipsByPersonQuery } from '../../../domain/model/queries/get-memberships-by-person.query.js';
import { GetRosterByCommunityQuery } from '../../../domain/model/queries/get-roster-by-community.query.js';
import { Membership } from '../../../domain/model/aggregates/membership.aggregate.js';
import { MembershipId } from '../../../domain/model/valueobjects/membership-id.value-object.js';
import { AssignRoleResource } from '../resources/assign-role.resource.js';
import { AssignUnitResource } from '../resources/assign-unit.resource.js';
import { EligibilityAnswerResource } from '../resources/eligibility-answer.resource.js';
import { JudgeEligibilityResource } from '../resources/judge-eligibility.resource.js';
import { MembershipResource } from '../resources/membership.resource.js';
import { ReasonResource } from '../resources/reason.resource.js';
import { RegisterMembershipResource } from '../resources/register-membership.resource.js';
import { MembershipParamsAssembler } from '../transform/membership-params.assembler.js';
import { MembershipResourceFromEntityAssembler } from '../transform/membership-resource-from-entity.assembler.js';
import { RegisterMembershipCommandFromResourceAssembler } from '../transform/register-membership-command-from-resource.assembler.js';
import { MembershipExceptionFilter } from '../filters/membership-exception.filter.js';

/**
 * Thin inbound adapter for the membership pair lifecycle: registration,
 * standing transitions, unit/role assignment, eligibility anchor and reads.
 * No business rules: every transition is judged by the Membership aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@ApiTags('memberships')
@Controller('memberships')
@UseFilters(MembershipExceptionFilter)
export class MembershipController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   * @param config Reads the global API prefix for Location headers.
   */
  constructor(
    @Inject(MEMBERSHIP_COMMAND_SERVICE) private readonly commands: MembershipCommandService,
    @Inject(MEMBERSHIP_QUERY_SERVICE) private readonly queries: MembershipQueryService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Registers a fresh (person, community) pair.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Pair already covered by a live membership' })
  async registerMembership(
    @Body() resource: RegisterMembershipResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MembershipResource> {
    const membershipId = await this.commands.registerMembership(
      RegisterMembershipCommandFromResourceAssembler.toCommandFromResource(resource),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/memberships/${membershipId.value}`);
    return this.requery(membershipId);
  }

  /**
   * Judges eligibility now (UC10 anchor). Absence answers NOT_A_MEMBER —
   * never 404 — with a frozen snapshot reference.
   */
  @Post('judge-eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EligibilityAnswerResource })
  async judgeEligibility(
    @Body() resource: JudgeEligibilityResource,
  ): Promise<EligibilityAnswerResource> {
    const snapshot = await this.commands.judgeEligibility(
      new JudgeEligibilityCommand(
        MembershipParamsAssembler.toPersonId(resource.personId),
        MembershipParamsAssembler.toCommunityId(resource.communityId),
      ),
    );
    return MembershipResourceFromEntityAssembler.toEligibilityAnswerResource(snapshot);
  }

  /**
   * Activates a REQUESTED membership.
   */
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Illegal transition or terminal' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async activateMembership(@Param('id') id: string): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.activateMembership(new ActivateMembershipCommand(membershipId));
    return this.requery(membershipId);
  }

  /**
   * Assigns the dwelling unit without touching standing history.
   */
  @Patch(':id/unit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async assignUnit(
    @Param('id') id: string,
    @Body() resource: AssignUnitResource,
  ): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.assignUnit(
      new AssignUnitCommand(
        membershipId,
        MembershipParamsAssembler.toUnit(resource.unitCode, resource.communityName),
      ),
    );
    return this.requery(membershipId);
  }

  /**
   * Assigns the community role; requires ACTIVE.
   */
  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Role requires ACTIVE' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async assignRole(
    @Param('id') id: string,
    @Body() resource: AssignRoleResource,
  ): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.assignCommunityRole(
      new AssignCommunityRoleCommand(membershipId, MembershipParamsAssembler.toRole(resource.role)),
    );
    return this.requery(membershipId);
  }

  /**
   * Marks an ACTIVE membership delinquent.
   */
  @Post(':id/mark-delinquent')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Illegal transition or reason required' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async markDelinquent(
    @Param('id') id: string,
    @Body() resource: ReasonResource,
  ): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.markDelinquent(
      new MarkDelinquentCommand(membershipId, MembershipParamsAssembler.toReason(resource.reason)),
    );
    return this.requery(membershipId);
  }

  /**
   * Clears delinquency back to ACTIVE.
   */
  @Post(':id/clear-delinquency')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Illegal transition' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async clearDelinquency(@Param('id') id: string): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.clearDelinquency(new ClearDelinquencyCommand(membershipId));
    return this.requery(membershipId);
  }

  /**
   * Suspends an ACTIVE or DELINQUENT membership.
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Illegal transition or reason required' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async suspendMembership(
    @Param('id') id: string,
    @Body() resource: ReasonResource,
  ): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.suspendMembership(
      new SuspendMembershipCommand(membershipId, MembershipParamsAssembler.toReason(resource.reason)),
    );
    return this.requery(membershipId);
  }

  /**
   * Reinstates a SUSPENDED membership back to ACTIVE.
   */
  @Post(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Illegal transition' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async reinstateMembership(@Param('id') id: string): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.reinstateMembership(new ReinstateMembershipCommand(membershipId));
    return this.requery(membershipId);
  }

  /**
   * Terminates the membership. Terminal.
   */
  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiConflictResponse({ description: 'Terminal or reason required' })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async terminateMembership(
    @Param('id') id: string,
    @Body() resource: ReasonResource,
  ): Promise<MembershipResource> {
    const membershipId = MembershipParamsAssembler.toMembershipId(id);
    await this.commands.terminateMembership(
      new TerminateMembershipCommand(membershipId, MembershipParamsAssembler.toReason(resource.reason)),
    );
    return this.requery(membershipId);
  }

  /**
   * Returns the membership or nothing.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MembershipResource })
  @ApiNotFoundResponse({ description: 'Unknown membership' })
  async getMembership(@Param('id') id: string): Promise<MembershipResource> {
    return this.requery(MembershipParamsAssembler.toMembershipId(id));
  }

  /**
   * Lists memberships: `?personId=` for a person's live memberships,
   * `?communityId=` for the roster. The roster answers ACTIVE memberships only
   * (the finder already narrows by standing; no status filter is accepted).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [MembershipResource] })
  async listMemberships(
    @Query('personId') personId?: string,
    @Query('communityId') communityId?: string,
  ): Promise<MembershipResource[]> {
    if (personId) {
      const list = await this.queries.getMembershipsByPerson(
        new GetMembershipsByPersonQuery(MembershipParamsAssembler.toPersonId(personId)),
      );
      return MembershipResourceFromEntityAssembler.toResourceList(list);
    }
    if (communityId) {
      const roster = await this.queries.getRosterByCommunity(
        new GetRosterByCommunityQuery(MembershipParamsAssembler.toCommunityId(communityId)),
      );
      return MembershipResourceFromEntityAssembler.toResourceList(roster);
    }
    return [];
  }

  /**
   * Re-reads the saved aggregate to rebuild the response resource.
   * @param membershipId Membership just written.
   */
  private async requery(membershipId: MembershipId): Promise<MembershipResource> {
    return MembershipResourceFromEntityAssembler.toResourceFromEntity(await this.requeryEntity(membershipId));
  }

  /**
   * Re-reads the saved aggregate or raises not-found.
   * @param membershipId Membership just written.
   */
  private async requeryEntity(membershipId: MembershipId): Promise<Membership> {
    const membership: Membership | null = await this.queries.getMembershipById(
      new GetMembershipByIdQuery(membershipId),
    );
    if (!membership) throw new NotFoundException();
    return membership;
  }
}
