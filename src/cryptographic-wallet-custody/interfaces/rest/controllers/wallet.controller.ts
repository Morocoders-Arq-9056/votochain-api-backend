import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RetireWalletCommand } from '../../../domain/model/commands/retire-wallet.command.js';
import { RotateWalletCommand } from '../../../domain/model/commands/rotate-wallet.command.js';
import { SignVoteContentCommand } from '../../../domain/model/commands/sign-vote-content.command.js';
import { SuspendWalletCommand } from '../../../domain/model/commands/suspend-wallet.command.js';
import { GetAdminshipHistoryByWalletQuery } from '../../../domain/model/queries/get-adminship-history-by-wallet.query.js';
import { GetSigningCapabilityByPersonQuery } from '../../../domain/model/queries/get-signing-capability-by-person.query.js';
import { GetUserWalletByIdQuery } from '../../../domain/model/queries/get-user-wallet-by-id.query.js';
import { WALLET_COMMAND_SERVICE, type WalletCommandService } from '../../../domain/services/wallet-command.service.js';
import { WALLET_QUERY_SERVICE, type WalletQueryService } from '../../../domain/services/wallet-query.service.js';
import { AdminshipEntryResource } from '../resources/adminship-entry.resource.js';
import { CapabilityResource } from '../resources/capability.resource.js';
import { ProvisionWalletResource } from '../resources/provision-wallet.resource.js';
import { RotateWalletResource } from '../resources/rotate-wallet.resource.js';
import { SignVoteContentResource } from '../resources/sign-vote-content.resource.js';
import { SignedContentResource } from '../resources/signed-content.resource.js';
import { SuspendWalletResource } from '../resources/suspend-wallet.resource.js';
import { WalletResource } from '../resources/wallet.resource.js';
import { WalletExceptionFilter } from '../filters/wallet-exception.filter.js';
import { ProvisionWalletCommandFromResourceAssembler } from '../transform/provision-wallet-command-from-resource.assembler.js';
import { WalletParamsAssembler } from '../transform/wallet-params.assembler.js';
import { WalletResourceFromEntityAssembler } from '../transform/wallet-resource-from-entity.assembler.js';

/**
 * Thin inbound adapter for wallet custody: provision, sign (UC2 anchor,
 * RPC-style command), rotate, suspend, retire, capability and history.
 * No business rules, no secrets in transit beyond the wire signature.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@ApiTags('wallets')
@Controller('wallets')
@UseFilters(WalletExceptionFilter)
export class WalletController {
  constructor(
    @Inject(WALLET_COMMAND_SERVICE) private readonly commands: WalletCommandService,
    @Inject(WALLET_QUERY_SERVICE) private readonly queries: WalletQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: WalletResource })
  @ApiConflictResponse({ description: 'The person already holds a live capability' })
  async provisionWallet(
    @Body() resource: ProvisionWalletResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WalletResource> {
    const id = await this.commands.provisionWallet(
      ProvisionWalletCommandFromResourceAssembler.toCommandFromResource(resource),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/wallets/${id.value}`);
    return this.requery(id.value);
  }

  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignedContentResource })
  @ApiNotFoundResponse({ description: 'Unknown wallet' })
  async signVoteContent(
    @Param('id') id: string,
    @Body() resource: SignVoteContentResource,
  ): Promise<SignedContentResource> {
    const walletId = WalletParamsAssembler.toUserWalletId(id);
    const signed = await this.commands.signVoteContent(
      new SignVoteContentCommand(
        walletId,
        WalletParamsAssembler.toSignedContentRef(resource.contentRef),
      ),
    );
    return new SignedContentResource(signed);
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WalletResource })
  async rotateWallet(
    @Param('id') id: string,
    @Body() resource: RotateWalletResource,
  ): Promise<WalletResource> {
    const walletId = WalletParamsAssembler.toUserWalletId(id);
    await this.commands.rotateWallet(
      new RotateWalletCommand(walletId, WalletParamsAssembler.toDerivationPosition(resource.newPosition)),
    );
    return this.requery(walletId.value);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WalletResource })
  async suspendWallet(
    @Param('id') id: string,
    @Body() resource: SuspendWalletResource,
  ): Promise<WalletResource> {
    const walletId = WalletParamsAssembler.toUserWalletId(id);
    await this.commands.suspendWallet(
      new SuspendWalletCommand(walletId, WalletParamsAssembler.toReason(resource.reason)),
    );
    return this.requery(walletId.value);
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WalletResource })
  async retireWallet(@Param('id') id: string): Promise<WalletResource> {
    const walletId = WalletParamsAssembler.toUserWalletId(id);
    await this.commands.retireWallet(new RetireWalletCommand(walletId));
    return this.requery(walletId.value);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CapabilityResource })
  async getCapability(@Query('personId') personId: string): Promise<CapabilityResource> {
    const answer = await this.queries.getSigningCapabilityByPerson(
      new GetSigningCapabilityByPersonQuery(WalletParamsAssembler.toPersonId(personId)),
    );
    return WalletResourceFromEntityAssembler.toCapabilityResource(answer);
  }

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AdminshipEntryResource] })
  @ApiNotFoundResponse({ description: 'Unknown wallet' })
  async getHistory(@Param('id') id: string): Promise<AdminshipEntryResource[]> {
    const walletId = WalletParamsAssembler.toUserWalletId(id);
    const events = await this.queries.getAdminshipHistoryByWallet(
      new GetAdminshipHistoryByWalletQuery(walletId),
    );
    return WalletResourceFromEntityAssembler.toHistoryResource(events);
  }

  private async requery(id: string): Promise<WalletResource> {
    const found = await this.queries.getUserWalletById(
      new GetUserWalletByIdQuery(WalletParamsAssembler.toUserWalletId(id)),
    );
    if (!found) throw new NotFoundException();
    return WalletResourceFromEntityAssembler.toResourceFromEntity(found);
  }
}
