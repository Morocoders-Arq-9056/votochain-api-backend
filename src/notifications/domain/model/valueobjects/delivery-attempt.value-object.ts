import type { DispatchStanding } from "./dispatch-standing.value-object.js";

/**
 * A single outcome appended to a dispatch history.
 *
 * Append-only: attempts are pushed, never edited in place, and the whole list
 * persists as `jsonb` on the dispatch row — always loaded with the root,
 * never queried per attempt.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface DeliveryAttempt {
  /** Moment the outcome was recorded. */
  at: Date;
  /** Outcome, always a member of the closed DispatchStanding set. */
  outcome: DispatchStanding;
  /** Optional detail (refusal cause, failure cause). */
  detail?: string;
}
