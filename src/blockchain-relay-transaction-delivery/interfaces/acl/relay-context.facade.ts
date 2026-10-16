/**
 * Published ACL this bounded context exposes (R5 OHS: Relay standing).
 * Primitives-only at the boundary; Voting translates to its own VOs.
 */
export const RELAY_CONTEXT_FACADE = Symbol('RELAY_CONTEXT_FACADE');

export interface RelayContextFacade {
  answerStanding(orderId: string): Promise<{ standing: string; reason: string | null }>;
}
