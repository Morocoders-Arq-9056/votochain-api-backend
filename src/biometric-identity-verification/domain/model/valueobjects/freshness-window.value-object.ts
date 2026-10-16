/**
 * How long one VERIFIED verdict authorizes; once elapsed it ages out.
 * Unstamped (`startsAt === null`) means the window is not yet open and never
 * authorizes.
 */
export class FreshnessWindow {
  constructor(
    public readonly durationMinutes: number,
    public readonly startsAt: Date | null = null,
  ) {
    if (durationMinutes <= 0) throw new Error('freshness must be positive');
  }

  static singleUse(durationMinutes: number): FreshnessWindow {
    return new FreshnessWindow(durationMinutes, null);
  }

  static rehydrate(startsAt: Date, durationMinutes: number): FreshnessWindow {
    return new FreshnessWindow(durationMinutes, startsAt);
  }

  stamp(now: Date): FreshnessWindow {
    return new FreshnessWindow(this.durationMinutes, now);
  }

  isElapsed(now: Date): boolean {
    if (!this.startsAt) return true;
    return now.getTime() > this.startsAt.getTime() + this.durationMinutes * 60000;
  }

  get start(): Date | null { return this.startsAt; }
}
