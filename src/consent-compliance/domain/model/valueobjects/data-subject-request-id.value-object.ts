import { randomUUID } from "node:crypto";

/** Typed identity DataSubjectRequestId. */
export class DataSubjectRequestId {
  private constructor(public readonly value: string) {}

  static generate(): DataSubjectRequestId { return new DataSubjectRequestId(`dsr-${randomUUID()}`); }

  static of(v: string): DataSubjectRequestId { if (!v?.trim()) throw new Error('invalid erasure request id'); return new DataSubjectRequestId(v); }

  equals(o: DataSubjectRequestId): boolean { return this.value === o.value; }
}
