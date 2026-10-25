import { Inject, Injectable } from "@nestjs/common";
import { SignedContentRef } from "../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { SignVoteContentCommand } from "../../domain/model/commands/sign-vote-content.command.js";
import { RetireWalletByPersonCommand } from "../../domain/model/commands/retire-wallet-by-person.command.js";
import { GetSigningCapabilityByPersonQuery } from "../../domain/model/queries/get-signing-capability-by-person.query.js";
import { PersonId } from "../../domain/model/valueobjects/person-id.value-object.js";
import { UserWalletId } from "../../domain/model/valueobjects/user-wallet-id.value-object.js";
import { CapabilityNotFoundError } from "../../domain/exceptions/capability-not-found.error.js";
import { WALLET_COMMAND_SERVICE } from "../../domain/services/wallet-command.service.js";
import type { WalletCommandService } from "../../domain/services/wallet-command.service.js";
import { WALLET_QUERY_SERVICE } from "../../domain/services/wallet-query.service.js";
import type { WalletQueryService } from "../../domain/services/wallet-query.service.js";
import type { WalletContextFacade } from "../../interfaces/acl/wallet-context.facade.js";

/**
 * Application implementation of the published {@link WalletContextFacade}.
 * Resolves the person's live capability, delegates to the command/query
 * services, and translates back to primitives.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class WalletContextFacadeImpl implements WalletContextFacade {
  constructor(
    @Inject(WALLET_COMMAND_SERVICE) private readonly commands: WalletCommandService,
    @Inject(WALLET_QUERY_SERVICE) private readonly queries: WalletQueryService,
  ) {}

  async sign(personId: string, contentRef: string): Promise<string> {
    const capability = await this.queries.getSigningCapabilityByPerson(
      new GetSigningCapabilityByPersonQuery(PersonId.of(personId)),
    );
    if (!capability.maySign || !capability.walletId)
      throw new CapabilityNotFoundError('no signing capability');
    return this.commands.signVoteContent(
      new SignVoteContentCommand(UserWalletId.of(capability.walletId), SignedContentRef.of(contentRef)),
    );
  }

  async answerCapability(
    personId: string,
  ): Promise<{ maySign: boolean; walletId: string | null; position: number | null }> {
    return this.queries.getSigningCapabilityByPerson(
      new GetSigningCapabilityByPersonQuery(PersonId.of(personId)),
    );
  }

  /**
   * Erasure execution: retires every non-retired capability by person.
   * @param personId Person id (`per-` prefixed string).
   */
  async retireWalletByPerson(personId: string): Promise<number> {
    return this.commands.retireWalletByPerson(
      new RetireWalletByPersonCommand(PersonId.of(personId)),
    );
  }
}
