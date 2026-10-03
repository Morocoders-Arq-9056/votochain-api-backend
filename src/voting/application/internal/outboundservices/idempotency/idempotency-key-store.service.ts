/**
 * Application outbound port: transport dedup for POST /votes.
 * `request_log` is NOT an aggregate, so it owns no domain repository port:
 * the application layer records the idempotency key with the resulting vote
 * id. The stored receipt snapshot was write-only and never read back, so the
 * store keeps key→voteId only. Primitives only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const IDEMPOTENCY_KEY_STORE = Symbol('IDEMPOTENCY_KEY_STORE');

export interface IdempotencyKeyStore {
  findVoteIdByKey(key: string): Promise<string | null>;
  saveVoteId(key: string, voteId: string): Promise<void>;
}
