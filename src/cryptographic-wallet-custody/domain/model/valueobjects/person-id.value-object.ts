import { randomUUID } from "node:crypto";

/**
 * Reference to a person (IAM identity), by reference only. Local copy of the
 * shared-kernel identity shape, mirroring the sibling contexts.
 */
export class PersonId {
  private constructor(public readonly value: string) {}

  static generate(): PersonId { return new PersonId(`per-${randomUUID()}`); }

  static of(v: string): PersonId {
    if (!v?.trim()) throw new Error('invalid person id');
    return new PersonId(v);
  }

  equals(o: PersonId): boolean { return this.value === o.value; }
}
