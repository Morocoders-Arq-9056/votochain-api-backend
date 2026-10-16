/**
 * How long an examination stays answerable: requestedAt + ttlMinutes.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class ValidityWindow {
  constructor(
    public readonly requestedAt: Date,
    public readonly ttlMinutes: number,
  ) {
    if (ttlMinutes <= 0) throw new Error('ttl must be positive');
  }

  static now(ttlMinutes: number): ValidityWindow {
    return new ValidityWindow(new Date(), ttlMinutes);
  }

  isElapsed(now: Date): boolean {
    return now.getTime() > this.requestedAt.getTime() + this.ttlMinutes * 60000;
  }

  equals(o: ValidityWindow): boolean {
    return this.requestedAt.getTime() === o.requestedAt.getTime() && this.ttlMinutes === o.ttlMinutes;
  }
}
