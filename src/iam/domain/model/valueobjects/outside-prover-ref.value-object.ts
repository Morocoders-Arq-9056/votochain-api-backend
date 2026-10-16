/**
 * Value object referencing an outside proof (identity) provider plus the
 * subject reference that provider vouches for.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class OutsideProverRef {
  /**
   * Creates a new OutsideProverRef instance.
   * @param provider The name of the outside proof provider.
   * @param externalId The provider-side subject reference (`sub`) that is linked.
   */
  private constructor(
    public readonly provider: string,
    public readonly externalId: string,
  ) {}

  /**
   * Creates an OutsideProverRef from a provider name and its subject reference,
   * accepting only supported providers.
   * @param provider The name of the outside proof provider.
   * @param externalId The provider-side subject reference that is linked.
   * @returns A new instance of OutsideProverRef.
   * @throws An error if the provider is not supported or the subject is blank.
   */
  static of(provider: string, externalId: string): OutsideProverRef {
    if (provider !== 'auth0') throw new Error(`unsupported outside prover: ${provider}`);
    if (!externalId?.trim()) throw new Error('externalId required');
    return new OutsideProverRef(provider, externalId);
  }

  /**
   * Compares this OutsideProverRef instance with another for equality.
   * @param o The other OutsideProverRef instance to compare with.
   * @returns True if both reference the same provider and subject, otherwise false.
   */
  equals(o: OutsideProverRef): boolean {
    return this.provider === o.provider && this.externalId === o.externalId;
  }
}