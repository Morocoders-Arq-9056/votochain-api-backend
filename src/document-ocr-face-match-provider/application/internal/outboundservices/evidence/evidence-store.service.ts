import type { DocumentEvidence } from './document-evidence.js';

export const EVIDENCE_STORE = Symbol('EVIDENCE_STORE');

export interface EvidenceStore {
  put(examinationId: string, evidence: DocumentEvidence): Promise<void>;
  take(examinationId: string): Promise<DocumentEvidence | null>;
  remove(examinationId: string): Promise<void>;
}
