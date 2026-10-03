import { CastVoteCommand } from "../model/commands/cast-vote.command.js";
import { MarkVoteConfirmedCommand } from "../model/commands/mark-vote-confirmed.command.js";
import { MarkVoteFailedCommand } from "../model/commands/mark-vote-failed.command.js";
import { MarkVoteQueuedCommand } from "../model/commands/mark-vote-queued.command.js";
import { MarkVoteSentCommand } from "../model/commands/mark-vote-sent.command.js";
import { VoteId } from "../model/valueobjects/vote-id.value-object.js";

export const VOTE_COMMAND_SERVICE = Symbol('VOTE_COMMAND_SERVICE');

/**
 * Domain port for vote writes (UC4 cast anchor, UC5/UC6 tracking).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */

export interface VoteCommandService {
  castVote(command: CastVoteCommand): Promise<VoteId>;
  /**
   * Casts once per idempotency key: a seen key replays the recorded vote id
   * without casting again; a fresh key casts then records. A lost race on
   * the key row replays the winner instead of failing.
   *
   * Deliberate exception to one-method-per-command: the key is transport
   * dedup owned by the application layer, not domain input, so it must not
   * enter `CastVoteCommand` — yet the check-cast-record sequence must live in
   * one orchestrated method to stay atomic. No business rule lives here.
   * @param command The vote to cast on a cache miss.
   * @param key Transport idempotency key.
   */
  castVoteIdempotent(command: CastVoteCommand, key: string): Promise<{ voteId: VoteId; replayed: boolean }>;
  markVoteQueued(command: MarkVoteQueuedCommand): Promise<void>;
  markVoteSent(command: MarkVoteSentCommand): Promise<void>;
  markVoteConfirmed(command: MarkVoteConfirmedCommand): Promise<void>;
  markVoteFailed(command: MarkVoteFailedCommand): Promise<void>;
}
