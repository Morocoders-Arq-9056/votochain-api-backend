/**
 * Value object representing the general facts of a community: name, domicile, contact.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunitySettings {
  /**
   * Creates a new CommunitySettings instance.
   * @param name The name of the community.
   * @param domicile The domicile of the community.
   * @param contact The contact of the community.
   */
  private constructor(
    public readonly name: string,
    public readonly domicile: string,
    public readonly contact: string,
  ) {}

  /**
   * Creates a new CommunitySettings instance with the provided facts.
   * Well-formed means present and distinguishable.
   * @param input The name, domicile and contact facts.
   * @returns A new instance of CommunitySettings.
   */
  static create(input: { name: string; domicile: string; contact: string }): CommunitySettings {
    if (!input.name?.trim()) throw new Error('name required');
    if (!input.domicile?.trim()) throw new Error('domicile required');
    if (!input.contact?.trim()) throw new Error('contact required');
    return new CommunitySettings(input.name, input.domicile, input.contact);
  }

  /**
   * Compares this CommunitySettings instance with another for equality.
   * @param o The other CommunitySettings instance to compare with.
   * @returns True if both hold the same facts, otherwise false.
   */
  equals(o: CommunitySettings): boolean {
    return this.name === o.name && this.domicile === o.domicile && this.contact === o.contact;
  }
}
