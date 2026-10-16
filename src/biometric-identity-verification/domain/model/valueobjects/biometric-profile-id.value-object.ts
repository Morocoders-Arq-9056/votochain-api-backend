import { randomUUID } from "node:crypto";

/** Identity of a BiometricProfile aggregate (`bio-` prefixed). */
export class BiometricProfileId {
  private constructor(public readonly value: string) {}

  static generate(): BiometricProfileId { return new BiometricProfileId(`bio-${randomUUID()}`); }

  static of(v: string): BiometricProfileId {
    if (!v?.trim()) throw new Error('invalid biometric profile id');
    return new BiometricProfileId(v);
  }

  equals(o: BiometricProfileId): boolean { return this.value === o.value; }
}
