import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentEvidence } from '../../../application/internal/outboundservices/evidence/document-evidence.js';
import { EVIDENCE_STORE, type EvidenceStore } from '../../../application/internal/outboundservices/evidence/evidence-store.service.js';

@Injectable()
export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly store = new Map<string, { evidence: DocumentEvidence; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  async put(examinationId: string, evidence: DocumentEvidence): Promise<void> {
    const ttlMinutes = this.config.get<number>('ocr.ttlMinutes', 30);
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    this.store.set(examinationId, { evidence, expiresAt });
  }

  async take(examinationId: string): Promise<DocumentEvidence | null> {
    const entry = this.store.get(examinationId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(examinationId);
      return null;
    }
    this.store.delete(examinationId);
    return entry.evidence;
  }

  async remove(examinationId: string): Promise<void> {
    this.store.delete(examinationId);
  }
}
