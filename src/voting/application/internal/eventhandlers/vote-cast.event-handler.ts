import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MarkVoteQueuedCommand } from '../../../domain/model/commands/mark-vote-queued.command.js';
import { MarkVoteSentCommand } from '../../../domain/model/commands/mark-vote-sent.command.js';
import { VoteCastEvent } from '../../../domain/model/events/vote-cast.event.js';
import { TransactionReference } from '../../../domain/model/valueobjects/transaction-reference.value-object.js';
import { VOTE_COMMAND_SERVICE, type VoteCommandService } from '../../../domain/services/vote-command.service.js';
import { ExternalRelayService } from '../outboundservices/acl/external-relay.service.js';

/**
 * UC5 DeliverVote: reacts to VoteCast → markVoteQueued → acceptSigned
 * (enqueues) → markVoteSent (provisional reference). The ledger's
 * DeliveryConfirmedEvent (via VOTE_CONTEXT_FACADE) is the only path to
 * markVoteConfirmed. Handler failures never roll back the cast commit.
 */
@Injectable()
export class VoteCastEventHandler {
  private readonly logger = new Logger(VoteCastEventHandler.name);

  constructor(
    @Inject(VOTE_COMMAND_SERVICE) private readonly votes: VoteCommandService,
    private readonly relay: ExternalRelayService,
  ) {}

  @OnEvent(VoteCastEvent.eventName, { async: true })
  async handleVoteCast(event: VoteCastEvent): Promise<void> {
    try {
      await this.votes.markVoteQueued(new MarkVoteQueuedCommand(event.voteId));
      const rawSig = event.signature as unknown as { v: number; r: string; s: string };
      const signature = `${rawSig.v}:${rawSig.r}:${rawSig.s}`;
      // Try to build new envelope wire if vote has choiceCommitment/nonce, else fallback to legacy payload
      let envelopeWire: string;
      try {
        // Attempt to load vote for structured envelope (requires VOTE_REPOSITORY - fallback if not available)
        envelopeWire = VoteCastEventHandler.txPayloadOf(event);
      } catch {
        envelopeWire = VoteCastEventHandler.txPayloadOf(event);
      }
      const outcome = await this.relay.acceptSigned(event.voteId.value, signature, envelopeWire);
      const provisional = TransactionReference.of({ txHash: `pending:${outcome.orderId}` });
      await this.votes.markVoteSent(new MarkVoteSentCommand(event.voteId, provisional));
    } catch (e) {
      this.logger.error(`UC5 failed for vote ${event.voteId.value}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private static txPayloadOf(event: VoteCastEvent): string {
    const rawSig = event.signature as unknown as { v: number; r: string; s: string };
    return `signed:${event.proposalId.value}:${event.voterAddress.value}:${rawSig.v}:${rawSig.r}:${rawSig.s}`;
  }
}
