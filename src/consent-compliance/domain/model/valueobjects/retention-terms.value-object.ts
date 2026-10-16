/**
 * Keeping rule terms for one data category (opaque JSON terms judged by the
 * compliance admin; confirmed erasure beats retention by default).
 */
export class RetentionTerms {
  private constructor(public readonly value: Record<string, unknown>) {}

  static of(v: Record<string, unknown>): RetentionTerms {
    if (!v || typeof v !== 'object') throw new Error('invalid retention terms');
    return new RetentionTerms({ ...v });
  }

  equals(o: RetentionTerms): boolean { return JSON.stringify(this.value) === JSON.stringify(o.value); }
}
