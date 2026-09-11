import { randomUUID } from "node:crypto";

/**
 * Value object representing a unique identifier for a person within VotoChain Platform.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class PersonId {
  /**
   * Creates a new PersonId instance.
   * 
   * @param value The value of the person ID.
   */
  private constructor(public readonly value: string) {}

  /**
   * Generates a new PersonId with a unique identifier.
   * @returns A new instance of PersonId with a unique identifier.
   */
  static generate(): PersonId { return new PersonId(`per-${randomUUID()}`); }

  /**
   * Creates a PersonId instance from a given string value.
   * @param v The string value to create the PersonId from.
   * @returns A new instance of PersonId with the provided value.
   */
  static of(v: string): PersonId { if (!v?.trim()) throw new Error('invalid person id'); return new PersonId(v); }
  
  /**
   * Compares the current PersonId instance with another PersonId instance for equality.
   * @param o The other PersonId instance to compare with.
   * @returns True if both PersonId instances have the same value, otherwise false.
   */
  equals(o: PersonId): boolean { return this.value === o.value; }
}