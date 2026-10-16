export const ConsentScopeValue = {
  BIOMETRIC_PROCESSING: 'BIOMETRIC_PROCESSING',
  EMAIL_NOTIFICATIONS: 'EMAIL_NOTIFICATIONS',
} as const;
export type ConsentScopeValue = (typeof ConsentScopeValue)[keyof typeof ConsentScopeValue];

/**
 * One scope per record, never blanket. Closed set: biometric processing +
 * email notices (Law 29733 finalidades).
 */
export class ConsentScope {
  private constructor(public readonly value: ConsentScopeValue) {}

  static of(v: string): ConsentScope {
    if (!(Object.values(ConsentScopeValue) as string[]).includes(v)) throw new Error(`invalid consent scope: ${v}`);
    return new ConsentScope(v as ConsentScopeValue);
  }

  equals(o: ConsentScope): boolean { return this.value === o.value; }
}

export function parseConsentScope(v: string): ConsentScope {
  return ConsentScope.of(v);
}
