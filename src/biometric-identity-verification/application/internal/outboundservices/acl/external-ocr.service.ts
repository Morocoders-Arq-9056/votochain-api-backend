import { Inject, Injectable } from "@nestjs/common";
import { OCR_CONTEXT_FACADE, type OcrContextFacade } from "../../../../../document-ocr-face-match-provider/interfaces/acl/ocr-context.facade.js";

/**
 * Outbound ACL toward the OCR context (R7, Customer/Supplier): the
 * single-use MATCH seeds the lasting reference. Nothing image-like crosses —
 * only the consumption boolean.
 */
@Injectable()
export class ExternalOcrService {
  constructor(@Inject(OCR_CONTEXT_FACADE) private readonly facade: OcrContextFacade) {}

  /**
   * Consumes any usable MATCH for the person, single-use.
   * @param personId Person id (`per-` prefixed string).
   */
  async consumeUsableMatch(personId: string): Promise<boolean> {
    return this.facade.consumeAnyUsableMatch(personId);
  }
}
