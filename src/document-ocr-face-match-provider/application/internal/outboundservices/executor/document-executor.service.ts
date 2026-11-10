import type { DocumentEvidence } from '../evidence/document-evidence.js';

/**
 * Technology port: observes the document verdict from an interchangeable
 * executor (Azure DI / Rekognition / GDocAI). The domain never imports
 * vendors — it only observes the judgments `{readable, reason}` / `{holds}`.
 *
 * Evidence is the transient bytes (application layer, never domain). When
 * called with a plain string `examinationId` (legacy/tests/CQRS without
 * ingestion) the executor must degrade gracefully.
 */
export const EXECUTOR_PORT = Symbol('EXECUTOR_PORT');

export type EvidenceInput = DocumentEvidence | string;

export interface DocumentExecutorService {
  observeExtraction(evidence: EvidenceInput): Promise<{ readable: boolean; reason: string | null }>;
  observeComparison(evidence: EvidenceInput): Promise<{ holds: boolean }>;
}
