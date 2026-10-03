import type { ResolvedTemplate } from "../../../../domain/model/valueobjects/resolved-template.value-object.js";

/**
 * Outbound port isolating the template catalog from the aggregate and the
 * command service. Resolution runs BEFORE the unit of work; unknown keys
 * throw before any row is written.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const TEMPLATE_RESOLVER = Symbol('TEMPLATE_RESOLVER');

export interface TemplateResolverService {
  /**
   * Resolves a template key plus raw values into a ResolvedTemplate.
   * @param key The template key to look up in the catalog.
   * @param values The raw render values supplied by the requester.
   * @throws TemplateUnknownError When the key names no catalog entry.
   */
  resolve(key: string, values: Record<string, string>): Promise<ResolvedTemplate>;
}
