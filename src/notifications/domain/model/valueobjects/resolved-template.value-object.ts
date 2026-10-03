/**
 * Value object holding a template already resolved against the catalog.
 *
 * Resolution happens in application before the unit of work: unknown keys never
 * reach the aggregate, so this object always names a known template plus its
 * render values.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class ResolvedTemplate {

  /**
   * Creates a new ResolvedTemplate instance.
   *
   * @param key The known template key.
   * @param values The render values for the template.
   */
  private constructor(
    public readonly key: string,
    public readonly values: Record<string, string>,
  ) {}

  /**
   * Creates a ResolvedTemplate instance from a key and its render values.
   * @param key The known template key.
   * @param values The render values for the template.
   * @returns A new instance of ResolvedTemplate.
   */
  static of(key: string, values: Record<string, string>): ResolvedTemplate {
    if (!key?.trim()) throw new Error('invalid template key');
    return new ResolvedTemplate(key, { ...values });
  }

  /**
   * Compares the current ResolvedTemplate instance with another one for equality.
   * @param o The other ResolvedTemplate instance to compare with.
   * @returns True when both key and values match.
   */
  equals(o: ResolvedTemplate): boolean {
    return this.key === o.key && JSON.stringify(this.values) === JSON.stringify(o.values);
  }
}
