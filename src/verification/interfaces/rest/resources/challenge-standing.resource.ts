/**
 * Challenge standing answer: usable now, with how many attempts left.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class ChallengeStandingResource {
  constructor(
    public readonly usable: boolean,
    public readonly remaining: number,
  ) {}
}
