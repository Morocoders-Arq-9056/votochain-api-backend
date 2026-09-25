/**
 * Current voting policy answer response.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class PolicyAnswerResource {
  constructor(
    public readonly threshold: number,
    public readonly basis: string,
    public readonly majorityRule: string,
  ) {}
}
