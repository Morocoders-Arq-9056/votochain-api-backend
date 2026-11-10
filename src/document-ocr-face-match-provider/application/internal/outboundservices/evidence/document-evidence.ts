/**
 * Transient evidence for an examination. Application-level type — never
 * domain. Buffers are held in memory/Redis only and die with the exam.
 */
export interface DocumentEvidence {
  readonly buffer: Buffer;
  readonly contentType: string;
  readonly documentType?: string;
  readonly examinationId?: string;
}
