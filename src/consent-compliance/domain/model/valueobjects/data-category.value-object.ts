/**
 * Data category a retention policy keeps (e.g. `biometric-reference`,
 * `wallet-capability`, `notification-log`).
 */
export class DataCategory {
  private constructor(public readonly value: string) {}

  static of(v: string): DataCategory {
    if (!v?.trim()) throw new Error('invalid data category');
    return new DataCategory(v);
  }

  equals(o: DataCategory): boolean { return this.value === o.value; }
}
