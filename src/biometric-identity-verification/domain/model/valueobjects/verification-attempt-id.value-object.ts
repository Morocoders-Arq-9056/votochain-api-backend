import { randomUUID } from "node:crypto";

/** Identity of a VerificationAttempt aggregate (`att-` prefixed). */
export class VerificationAttemptId {
  private constructor(public readonly value: string) {}

  static generate(): VerificationAttemptId { return new VerificationAttemptId(`att-${randomUUID()}`); }

  static of(v: string): VerificationAttemptId {
    if (!v?.trim()) throw new Error('invalid verification attempt id');
    return new VerificationAttemptId(v);
  }

  equals(o: VerificationAttemptId): boolean { return this.value === o.value; }
}
