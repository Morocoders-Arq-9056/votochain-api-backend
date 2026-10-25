export const ErasureOwnerValue = {
  biometric: 'biometric',
  wallet: 'wallet',
  membership: 'membership',
  notifications: 'notifications',
} as const;
export type ErasureOwnerValue = (typeof ErasureOwnerValue)[keyof typeof ErasureOwnerValue];

/**
 * Closed set of contexts that own personal data and must confirm erasure
 * (R12 Partnership). Lowercase values match `ERASURE_OWNERS` coordination
 * keys and the persisted `confirmations` jsonb. Replaces the former
 * `owner: string` primitive in commands/events.
 */
export class ErasureOwner {
  private constructor(public readonly value: ErasureOwnerValue) {}

  static of(v: string): ErasureOwner {
    if (!(Object.values(ErasureOwnerValue) as string[]).includes(v)) throw new Error(`invalid erasure owner: ${v}`);
    return new ErasureOwner(v as ErasureOwnerValue);
  }

  equals(o: ErasureOwner): boolean { return this.value === o.value; }
  toString(): string { return this.value; }
}

export function parseErasureOwner(v: string): ErasureOwner {
  return ErasureOwner.of(v);
}
