/**
 * Reference to the identity document under examination. Identity by
 * reference only — the evidence itself never outlives the examination.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class DocumentRef {
  private constructor(public readonly value: string) {}

  static of(v: string): DocumentRef {
    if (!v?.trim()) throw new Error('invalid document ref');
    return new DocumentRef(v);
  }

  equals(o: DocumentRef): boolean { return this.value === o.value; }
}
