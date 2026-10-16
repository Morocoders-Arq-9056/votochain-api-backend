/**
 * Published ACL this bounded context exposes to other contexts (R7).
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from DocumentOcrFaceMatchProviderModule via
 * OCR_CONTEXT_FACADE.
 */
export const OCR_CONTEXT_FACADE = Symbol('OCR_CONTEXT_FACADE');

export interface OcrContextFacade {
  /**
   * Answers whether a usable (concluded MATCH, not yet consumed) examination
   * exists for the pair. Pure read.
   * @param personId Person id (`per-` prefixed string).
   * @param documentRef Document reference.
   */
  answerUsableMatch(personId: string, documentRef: string): Promise<{ usableMatch: boolean }>;

  /**
   * Consumes the usable MATCH single-use (R7): marks it consumed and saves
   * within one unit of work. A second call answers `false`.
   * @param personId Person id (`per-` prefixed string).
   * @param documentRef Document reference.
   */
  consumeMatch(personId: string, documentRef: string): Promise<boolean>;

  /**
   * Consumes any usable MATCH for the person, whatever the document (the
   * Biometric enrollment does not carry a document reference). Single-use.
   * @param personId Person id (`per-` prefixed string).
   */
  consumeAnyUsableMatch(personId: string): Promise<boolean>;
}
