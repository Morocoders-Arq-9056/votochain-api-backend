/**
 * Value object referencing an outside proof (identity) provider.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class OutsideProverRef {
  /**
   * Creates a new OutsideProverRef instance.
   * @param provider The name of the outside proof provider.
   */
  private constructor(public readonly provider: string) {}

  /**
   * Creates an OutsideProverRef from a provider name, accepting only supported providers.
   * @param provider The name of the outside proof provider.
   * @returns A new instance of OutsideProverRef.
   * @throws An error if the provider is not supported.
   */
  static of(provider: string): OutsideProverRef {
    if (provider !== 'auth0') throw new Error(`unsupported outside prover: ${provider}`);
    return new OutsideProverRef(provider);
  }

  /**
   * Compares this OutsideProverRef instance with another for equality.
   * @param o The other OutsideProverRef instance to compare with.
   * @returns True if both reference the same provider, otherwise false.
   */
  equals(o: OutsideProverRef): boolean { return this.provider === o.provider; }
}