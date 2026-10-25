import { ErasureOwner } from "./erasure-owner.value-object.js";

/**
 * Per-owner revocation tracking of one erasure request. Persisted as `jsonb`
 * (never queried per-owner): `{ asked: string[]; confirmed: string[] }`.
 * The domain API speaks `ErasureOwner`; strings live only at the jsonb edge.
 * `record()` is idempotent; completion requires `allConfirmed()`.
 */
export class RevocationConfirmations {
  private readonly askedOwners: string[];
  private readonly confirmedOwners: string[];

  constructor(asked: string[], confirmed: string[] = []) {
    this.askedOwners = [...asked];
    this.confirmedOwners = [...confirmed];
  }

  askOwners(owners: ErasureOwner[]): void {
    for (const o of owners) if (!this.askedOwners.includes(o.value)) this.askedOwners.push(o.value);
  }

  isAsked(owner: ErasureOwner): boolean { return this.askedOwners.includes(owner.value); }

  record(owner: ErasureOwner): boolean {
    if (!this.confirmedOwners.includes(owner.value)) {
      this.confirmedOwners.push(owner.value);
      return true;
    }
    return false;
  }

  allConfirmed(): boolean {
    return this.askedOwners.length > 0 && this.askedOwners.every((o) => this.confirmedOwners.includes(o));
  }

  pending(): string[] { return this.askedOwners.filter((o) => !this.confirmedOwners.includes(o)); }
  confirmed(): string[] { return [...this.confirmedOwners]; }

  toJSON(): { asked: string[]; confirmed: string[] } {
    return { asked: [...this.askedOwners], confirmed: [...this.confirmedOwners] };
  }

  static fromJSON(v: { asked: string[]; confirmed: string[] } | null | undefined): RevocationConfirmations {
    return new RevocationConfirmations(v?.asked ?? [], v?.confirmed ?? []);
  }
}
