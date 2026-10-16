/**
 * Privacy-policy version frozen at grant.
 */
export class PolicyVersion {
  private constructor(public readonly value: string) {}

  static of(v: string): PolicyVersion {
    if (!v?.trim()) throw new Error('invalid policy version');
    return new PolicyVersion(v);
  }

  equals(o: PolicyVersion): boolean { return this.value === o.value; }
}
