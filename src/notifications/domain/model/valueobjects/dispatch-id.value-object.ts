import { randomUUID } from "node:crypto";

/**
 * Value object identifying a single notification dispatch.
 *
 * Generated server-side per attempt chain; retries append on the same
 * dispatch, so this id names the whole outcome history, not one send.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DispatchId {

  /**
   * Creates a new DispatchId instance.
   *
   * @param value The value of the dispatch id.
   */
  private constructor(public readonly value: string) {}

  /**
   * Generates a new DispatchId with a unique identifier.
   * @returns A new instance of DispatchId with a unique identifier.
   */
  static generate(): DispatchId { return new DispatchId(`dsp-${randomUUID()}`); }

  /**
   * Creates a DispatchId instance from a given string value.
   * @param v The string value to create the DispatchId from.
   * @returns A new instance of DispatchId with the provided value.
   */
  static of(v: string): DispatchId { if (!v?.trim()) throw new Error('invalid dispatch id'); return new DispatchId(v); }

  /**
   * Compares the current DispatchId instance with another one for equality.
   * @param o The other DispatchId instance to compare with.
   * @returns True when both instances carry the same value.
   */
  equals(o: DispatchId): boolean { return this.value === o.value; }
}
