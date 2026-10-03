/**
 * Dwelling unit a membership is attached to. Attribute of the aggregate:
 * membership follows the person, the unit is just assigned (H4). Belonging
 * to the community is judged at the aggregate level, not here.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class Unit {
  /**
   * Creates a unit reference; use {@link Unit.of}.
   * @param code Dwelling code within the community.
   * @param communityName Community display name, carried for readability only.
   */
  private constructor(
    public readonly code: string,
    public readonly communityName?: string,
  ) {}

  /**
   * Builds a unit reference from boundary strings.
   * @param code Dwelling code within the community.
   * @param communityName Community display name, carried for readability only.
   */
  static of(code: string, communityName?: string): Unit {
    if (!code?.trim()) throw new Error('unit code required');
    return new Unit(code, communityName);
  }

  /**
   * Value comparison.
   * @param o Other unit.
   */
  equals(o: Unit): boolean {
    return this.code === o.code && this.communityName === o.communityName;
  }
}
