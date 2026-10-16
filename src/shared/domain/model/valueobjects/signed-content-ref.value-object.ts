/**
 * Shared-kernel value object: an opaque reference to vote content that is
 * transiently open for signing. Owned by Voting; Wallet and Relay consume it
 * by identity only — a carrier never inspects or signs on its own (R4/R5/R6).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class SignedContentRef {
  private constructor(public readonly value: string) {}

  static of(v: string): SignedContentRef {
    if (!v?.trim()) throw new Error('invalid signed content ref');
    return new SignedContentRef(v);
  }

  equals(o: SignedContentRef): boolean { return this.value === o.value; }
}
