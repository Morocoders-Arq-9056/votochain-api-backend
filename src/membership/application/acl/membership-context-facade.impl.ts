import { Inject, Injectable } from "@nestjs/common";
import { MEMBERSHIP_COMMAND_SERVICE } from "../../domain/services/membership-command.service.js";
import type { MembershipCommandService } from "../../domain/services/membership-command.service.js";
import { MEMBERSHIP_QUERY_SERVICE } from "../../domain/services/membership-query.service.js";
import type { MembershipQueryService } from "../../domain/services/membership-query.service.js";
import { JudgeEligibilityCommand } from "../../domain/model/commands/judge-eligibility.command.js";
import { GetMembershipByPersonAndCommunityQuery } from "../../domain/model/queries/get-membership-by-person-and-community.query.js";
import { GetRosterByCommunityQuery } from "../../domain/model/queries/get-roster-by-community.query.js";
import { CommunityId } from "../../domain/model/valueobjects/community-id.value-object.js";
import { PersonId } from "../../domain/model/valueobjects/person-id.value-object.js";
import { MembershipNotFoundError } from "../../domain/exceptions/membership-not-found.error.js";
import type { JudgeEligibilityAnswerDto, MembershipContextFacade } from "../../interfaces/acl/membership-context.facade.js";

/**
 * Application implementation of the published {@link MembershipContextFacade}.
 * Translates primitive boundary strings into domain VOs, delegates to the
 * command/query services, and translates back to primitives.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipContextFacadeImpl implements MembershipContextFacade {
  /**
   * Wires the facade over the write and read application services.
   * @param commands Write-side service (judgment produces a frozen fact).
   * @param queries Read-side service (roster and pair lookups).
   */
  constructor(
    @Inject(MEMBERSHIP_COMMAND_SERVICE) private readonly commands: MembershipCommandService,
    @Inject(MEMBERSHIP_QUERY_SERVICE) private readonly queries: MembershipQueryService,
  ) {}

  /**
   * Judges eligibility now; absence answers NOT_A_MEMBER, never 404.
   * @param personId Person id (`per-` prefixed string).
   * @param communityId Community id (`com-` prefixed string).
   */
  async judgeEligibility(personId: string, communityId: string): Promise<JudgeEligibilityAnswerDto> {
    const person = this.toPersonId(personId);
    const community = this.toCommunityId(communityId);
    const snapshot = await this.commands.judgeEligibility(new JudgeEligibilityCommand(person, community));
    const live = await this.queries.getMembershipByPersonAndCommunity(
      new GetMembershipByPersonAndCommunityQuery(person, community),
    );
    const reason = snapshot.verdict
      ? 'ELIGIBLE'
      : !live ? 'NOT_A_MEMBER' : `NOT_ELIGIBLE_${live.status}`;
    return { eligible: snapshot.verdict, reason, snapshotRef: snapshot.reference };
  }

  /**
   * Lists the person ids holding an ACTIVE membership in the community.
   * @param communityId Community id (`com-` prefixed string).
   */
  async getRoster(communityId: string): Promise<string[]> {
    const community = this.toCommunityId(communityId);
    const roster = await this.queries.getRosterByCommunity(new GetRosterByCommunityQuery(community));
    return roster.map((m) => m.personId.value);
  }

  /**
   * Parses a person id string or raises the read rejection.
   * @param personId Raw person id string.
   */
  private toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new MembershipNotFoundError('membership not found');
    }
  }

  /**
   * Parses a community id string or raises the read rejection.
   * @param communityId Raw community id string.
   */
  private toCommunityId(communityId: string): CommunityId {
    try {
      return CommunityId.of(communityId);
    } catch {
      throw new MembershipNotFoundError('membership not found');
    }
  }
}
