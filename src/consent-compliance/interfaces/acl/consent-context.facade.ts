/**
 * Published ACL this bounded context exposes (R12 Partnership).
 * Primitives-only at the boundary; each consumer wraps with its own VOs.
 */
export const CONSENT_CONTEXT_FACADE = Symbol('CONSENT_CONTEXT_FACADE');

export interface ConsentContextFacade {
  mayProcessNow(personId: string, scope: string): Promise<{ granted: boolean; policyVersion: string }>;
  mayContactNow(personId: string): Promise<boolean>;
  getErasureStanding(personId: string): Promise<{ standing: string; pending: string[] }>;
}
