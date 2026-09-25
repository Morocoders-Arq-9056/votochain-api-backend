/**
 * Entrusted administrator response.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class AdminResource {
  constructor(
    public readonly personId: string,
    public readonly entrustedAt: Date,
  ) {}
}
