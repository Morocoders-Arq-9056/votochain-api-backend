export const ConsentStanding = { GRANTED: 'GRANTED', REVOKED: 'REVOKED' } as const;
export type ConsentStanding = (typeof ConsentStanding)[keyof typeof ConsentStanding];

export function parseConsentStanding(v: string): ConsentStanding {
  if (!(Object.values(ConsentStanding) as string[]).includes(v)) throw new Error(`invalid consent standing: ${v}`);
  return v as ConsentStanding;
}

export const ErasureStanding = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  COORDINATED: 'COORDINATED',
  AWAITING_CONFIRMATIONS: 'AWAITING_CONFIRMATIONS',
  COMPLETED: 'COMPLETED',
} as const;
export type ErasureStanding = (typeof ErasureStanding)[keyof typeof ErasureStanding];

export function parseErasureStanding(v: string): ErasureStanding {
  if (!(Object.values(ErasureStanding) as string[]).includes(v)) throw new Error(`invalid erasure standing: ${v}`);
  return v as ErasureStanding;
}

/**
 * Owner contexts coordinated per erasure (R12 Partnership). Values match
 * `ErasureOwner` (`./erasure-owner.value-object.js`); the class is the
 * boundary/domain type, this const is the coordination list. Adding an owner
 * means adding an `ExternalXService` — never touching the domain.
 */
export const ERASURE_OWNERS = ['biometric', 'wallet', 'membership', 'notifications'] as const;
