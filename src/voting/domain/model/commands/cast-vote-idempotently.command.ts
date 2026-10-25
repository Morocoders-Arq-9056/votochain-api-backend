import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { Choice } from "../valueobjects/choice.value-object.js";
import { CastVoteCommand } from "./cast-vote.command.js";

/**
 * Idempotent vote command: carries the transport dedup key alongside the
 * vote intent so `VoteCommandService` keeps one method per command type
 * (`castVote` ← CastVoteCommand, `castVoteIdempotently` ← this class).
 * The key never enters the `Vote` aggregate — it only drives the
 * `IDEMPOTENCY_KEY_STORE` check-cast-record sequence in application.
 */
export class CastVoteIdempotentlyCommand {
  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly choice: Choice,
    public readonly idempotencyKey: string,
  ) {
    if (!authorizationId) throw new Error('authorizationId required');
    if (!choice) throw new Error('choice required');
    if (!idempotencyKey?.trim()) throw new Error('idempotencyKey required');
  }

  toCastVoteCommand(): CastVoteCommand {
    return new CastVoteCommand(this.authorizationId, this.choice);
  }
}
