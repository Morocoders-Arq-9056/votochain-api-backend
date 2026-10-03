import { Injectable } from "@nestjs/common";
import { TemplateUnknownError } from "../../../domain/exceptions/template-unknown.error.js";
import { ResolvedTemplate } from "../../../domain/model/valueobjects/resolved-template.value-object.js";
import type { TemplateResolverService } from "../../../application/internal/outboundservices/template/template-resolver.service.js";

/**
 * In-memory template catalog: the known keys this boundary can render.
 * Unknown keys throw before any row is written (resolved ahead of the run).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class TemplateResolverAdapter implements TemplateResolverService {
  /** Known template keys of the MVP catalog. */
  private static readonly KNOWN = new Set(['vote-cast', 'welcome', 'security', 'challenge-code']);

  /**
   * Resolves a template key plus raw values into a ResolvedTemplate.
   * @param key The template key to look up in the catalog.
   * @param values The raw render values supplied by the requester.
   * @throws TemplateUnknownError When the key names no catalog entry.
   */
  async resolve(key: string, values: Record<string, string>): Promise<ResolvedTemplate> {
    if (!TemplateResolverAdapter.KNOWN.has(key)) throw new TemplateUnknownError(`unknown template: ${key}`);
    return ResolvedTemplate.of(key, values ?? {});
  }
}
