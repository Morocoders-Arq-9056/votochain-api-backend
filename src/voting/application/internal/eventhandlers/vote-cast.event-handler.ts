import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MarkVoteConfirmedCommand } from "../../../domain/model/commands/mark-vote-confirmed.command.js";
import { MarkVoteFailedCommand } from "../../../domain/model/commands/mark-vote-failed.command.js";
import { MarkVoteQueuedCommand } from "../../../domain/model/commands/mark-vote-queued.command.js";
import { MarkVoteSentCommand } from "../../../domain/model/commands/mark-vote-sent.command.js";
import { VoteCastEvent } from "../../../domain/model/events/vote-cast.event.js";
import { TransactionReference } from "../../../domain/model/valueobjects/transaction-reference.value-object.js";
import { VoteFailureReason } from "../../../domain/model/valueobjects/vote-failure-reason.value-object.js";
import { VOTE_COMMAND_SERVICE, type VoteCommandService } from "../../../domain/services/vote-command.service.js";
import { type ExternalRelayService } from "../outboundservices/acl/external-relay.service.js";

/**
 * UC5 DeliverVote: reacts to VoteCast in-module → markVoteQueued →
 * ExternalRelayService.acceptSigned (R5, real Sprint-04 delivery) →
 * markVoteSent → markVoteConfirmed (only this feeds the tally, H4) or
 * markVoteFailed (+retry reuses the same vote identity). Handler failures
 * never roll back the cast commit; each step is its own transaction.
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
      // Serialization-safe: outbox recovery replays plain-JSON payloads, so
      // read plain-data fields (`v/r/s`) instead of the `toString()` method.
      const rawSig = event.signature as unknown as { v: number; r: string; s: string };
      const signature = `${rawSig.v}:${rawSig.r}:${rawSig.s}`;
      const outcome = await this.relay.acceptSigned(event.voteId.value, signature,
        VoteCastEventHandler.txPayloadOf(event));
      const reference = TransactionReference.of({ txHash: outcome.orderId ? `relay:${outcome.orderId}` : `vote:${event.voteId.value}` });
      await this.votes.markVoteSent(new MarkVoteSentCommand(event.voteId, reference));
      if (outcome.confirmed) {
        await this.votes.markVoteConfirmed(new MarkVoteConfirmedCommand(event.voteId, reference, 1));
      } else {
        await this.votes.markVoteFailed(new MarkVoteFailedCommand(event.voteId, VoteFailureReason.fromUnknown(outcome.reason), true));
      }
    } catch (e) {
      this.logger.error(`UC5 failed for vote ${event.voteId.value}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private static txPayloadOf(event: VoteCastEvent): string {
    const rawSig = event.signature as unknown as { v: number; r: string; s: string };
    return `signed:${event.proposalId.value}:${event.voterAddress.value}:${rawSig.v}:${rawSig.r}:${rawSig.s}`;
  }
}
