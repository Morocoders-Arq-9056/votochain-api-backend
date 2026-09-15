import { Injectable } from '@nestjs/common';
import type { ProofVerificationService } from '../../../../application/internal/outboundservices/proof/proof-verification.service.js';

@Injectable()
export class FakeProofVerificationService implements ProofVerificationService {
  constructor(private readonly result = true) {}
  async holds(): Promise<boolean> { return this.result; }
}
