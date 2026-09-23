/**
 * Value object for the answerable window of a challenge.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export class ValidityWindow {
  private constructor(
    public readonly requestedAt: Date,
    public readonly expiresAt: Date,
  ) {}

  /**
   * Creates a new ValidityWindow instance starting from the current time and lasting for the specified number of minutes.
   * @param minutes The duration of the validity window in minutes. Defaults to 5 minutes if not provided.
   * @param now The current date and time to use as the starting point for the validity window. Defaults to the current system time if not provided.
   * @returns A new instance of ValidityWindow starting from the current time and lasting for the specified number of minutes.
   */
  static fromNow(minutes = 5, now: Date = new Date()): ValidityWindow {
    if (!Number.isFinite(minutes) || minutes <= 0) throw new Error(`invalid window minutes: ${minutes}`);
    return new ValidityWindow(new Date(now), new Date(now.getTime() + minutes * 60_000));
  }

  /**
   * Creates a new ValidityWindow instance with the specified requestedAt and expiresAt values.
   * @param requestedAt The date and time when the validity window was requested.
   * @param expiresAt The date and time when the validity window expires.
   * @returns A new instance of ValidityWindow with the provided requestedAt and expiresAt values.
   */
  static of(requestedAt: Date, expiresAt: Date): ValidityWindow {
    if (!(requestedAt instanceof Date) || Number.isNaN(requestedAt.getTime())) throw new Error('requestedAt required');
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) throw new Error('expiresAt required');
    if (expiresAt <= requestedAt) throw new Error('expiresAt must be after requestedAt');
    return new ValidityWindow(new Date(requestedAt), new Date(expiresAt));
  }

  /**
   * Checks if the current ValidityWindow instance has elapsed based on the provided date.
   * @param now The current date to check against the validity window.
   * @returns True if the current date is equal to or after the expiresAt date, otherwise false.
   */
  isElapsed(now: Date): boolean { return now.getTime() >= this.expiresAt.getTime(); }

  /**
   * Compares the current ValidityWindow instance with another ValidityWindow instance for equality.
   * @param o The other ValidityWindow instance to compare with.
   * @returns True if both ValidityWindow instances have the same requestedAt and expiresAt values, otherwise false.
   */
  equals(o: ValidityWindow): boolean {
    return this.requestedAt.getTime() === o.requestedAt.getTime()
      && this.expiresAt.getTime() === o.expiresAt.getTime();
  }
}