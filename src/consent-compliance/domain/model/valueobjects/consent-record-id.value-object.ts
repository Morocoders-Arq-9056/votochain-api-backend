import { randomUUID } from "node:crypto";

/** Typed identity ConsentRecordId. */
export class ConsentRecordId {
  private constructor(public readonly value: string) {}

  static generate(): ConsentRecordId { return new ConsentRecordId(`csr-${randomUUID()}`); }

  static of(v: string): ConsentRecordId { if (!v?.trim()) throw new Error('invalid consent record id'); return new ConsentRecordId(v); }

  equals(o: ConsentRecordId): boolean { return this.value === o.value; }
}
