import { CastVoteCommand } from "../model/commands/cast-vote.command.js";
import { CastVoteIdempotentlyCommand } from "../model/commands/cast-vote-idempotently.command.js";
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
   * Dedicated command type (skill 1-method-per-command): the key is transport
   * dedup owned by the application layer, wrapped with the vote intent so it
   * never enters `CastVoteCommand` nor the `Vote` aggregate.
   */
  castVoteIdempotently(command: CastVoteIdempotentlyCommand): Promise<{ voteId: VoteId; replayed: boolean }>;
  markVoteQueued(command: MarkVoteQueuedCommand): Promise<void>;
  markVoteSent(command: MarkVoteSentCommand): Promise<void>;
  markVoteConfirmed(command: MarkVoteConfirmedCommand): Promise<void>;
  markVoteFailed(command: MarkVoteFailedCommand): Promise<void>;
}
