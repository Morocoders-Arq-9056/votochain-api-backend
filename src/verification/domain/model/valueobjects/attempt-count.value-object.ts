/**
 * Value object counting judged attempts against a challenge.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export class AttemptCount {
  private constructor(
    public readonly count: number,
    public readonly max: number,
  ) {}

  /**
   * Creates a new AttemptCount instance with a count of 0 and the specified maximum attempts.
   * @param max The maximum allowed attempts. Defaults to 5 if not provided. 
   * @returns A new instance of AttemptCount with a count of 0 and the specified max attempts.
   */
  static fresh(max = 5): AttemptCount {
    return AttemptCount.of(0, max);
  }

  /**
   * Creates a new AttemptCount instance with the specified count and max values.
   * @param count The current count of attempts.
   * @param max The maximum allowed attempts.
   * @returns A new instance of AttemptCount with the provided count and max values.
   */
  static of(count: number, max: number): AttemptCount {
    if (!Number.isInteger(count) || count < 0) throw new Error(`invalid attempt count: ${count}`);
    if (!Number.isInteger(max) || max <= 0) throw new Error(`invalid max attempts: ${max}`);
    if (count > max) throw new Error(`attempt count ${count} exceeds max ${max}`);
    return new AttemptCount(count, max);
  }

  /**
   * Increments the current AttemptCount instance by one, returning a new AttemptCount instance with the updated count.
   * @returns A new AttemptCount instance with the incremented count.
   */
  counted(): AttemptCount {
    if (this.isExhausted()) throw new Error('attempts exhausted');
    return new AttemptCount(this.count + 1, this.max);
  }

  /**
   * Returns the number of remaining attempts before reaching the maximum allowed attempts.
   * @returns The number of remaining attempts. 
   */
  remaining(): number { return this.max - this.count; }

  /**
   * Checks if the current AttemptCount instance has exhausted its allowed attempts.
   * @returns True if the count has reached or exceeded the max attempts, otherwise false.
   */
  isExhausted(): boolean { return this.count >= this.max; }
  
  /**
   * Compares the current AttemptCount instance with another AttemptCount instance for equality.
   * @param o The other AttemptCount instance to compare with.
   * @returns True if both AttemptCount instances have the same count and max values, otherwise false.
   */
  equals(o: AttemptCount): boolean { return this.count === o.count && this.max === o.max; }
}