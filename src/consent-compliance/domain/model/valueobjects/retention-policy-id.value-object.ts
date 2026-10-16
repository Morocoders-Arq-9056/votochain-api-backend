import { randomUUID } from "node:crypto";

/** Typed identity RetentionPolicyId. */
export class RetentionPolicyId {
  private constructor(public readonly value: string) {}

  static generate(): RetentionPolicyId { return new RetentionPolicyId(`rpo-${randomUUID()}`); }

  static of(v: string): RetentionPolicyId { if (!v?.trim()) throw new Error('invalid retention policy id'); return new RetentionPolicyId(v); }

  equals(o: RetentionPolicyId): boolean { return this.value === o.value; }
}
