/**
 * Challenge response. Carries judgments and lifecycle state only —
 * never the plain code, never its hash.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class ChallengeResource {
  constructor(
    public readonly challengeId: string,
    public readonly personId: string,
    public readonly purpose: string,
    public readonly standing: string,
    public readonly attempts: number,
    public readonly maxAttempts: number,
    public readonly remaining: number,
    public readonly requestedAt: Date,
    public readonly expiresAt: Date,
    public readonly reason: string | null,
  ) {}
}
