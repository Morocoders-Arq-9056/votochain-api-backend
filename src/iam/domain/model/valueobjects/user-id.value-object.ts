import { randomUUID } from "node:crypto";

/**
 * Value object representing a unique identifier for a user within VotoChain Platform.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class UserId {

  /**
   * Creates a new UserId instance.
   * 
   * @param value The value of the user ID.
   */
  private constructor(public readonly value: string) {}

  /**
   * Generates a new UserId with a unique identifier.
   * @returns A new instance of UserId with a unique identifier.
   */
  static generate(): UserId { return new UserId(`usr-${randomUUID()}`); }

  /**
   * Creates a UserId instance from a given string value.
   * @param v The string value to create the UserId from.
   * @returns A new instance of UserId with the provided value.
   */
  static of(v: string): UserId { if (!v?.trim()) throw new Error('invalid user id'); return new UserId(v); }

  /**
   * Compares the current UserId instance with another UserId instance for equality.
   * @param o The other UserId instance to compare with.
   * @returns True if both UserId instances have the same value, otherwise false.
   */
  equals(o: UserId): boolean { return this.value === o.value; }
}