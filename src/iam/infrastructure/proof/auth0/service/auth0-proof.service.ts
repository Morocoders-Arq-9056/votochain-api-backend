import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { ProofVerificationService } from '../../../../application/internal/outboundservices/proof/proof-verification.service.js';

@Injectable()
export class Auth0ProofService implements ProofVerificationService {
  private readonly jwks;
  private readonly audience: string;
  private readonly issuer: string;

  constructor(config: ConfigService) {
    const domain = config.getOrThrow<string>('auth0.domain');
    this.audience = config.getOrThrow<string>('auth0.audience');
    this.issuer = `https://${domain}/`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}.well-known/jwks.json`));
  }

  async holds(offeredProof: string): Promise<boolean> {
    if (!offeredProof?.trim()) return false;
    try {
      const { payload } = await jwtVerify(offeredProof, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      return !!payload.sub;
    } catch {
      return false;
    }
  }
}