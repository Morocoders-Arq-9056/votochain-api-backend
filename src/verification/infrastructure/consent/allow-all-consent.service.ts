import { Injectable } from "@nestjs/common";
import type { ExternalConsentService } from "../../application/internal/outboundservices/acl/external-consent.service.js";

/**
 * Sprint-01 fake: every contact is allowed now. Keeps the slice free of the
 * Consent & Compliance dependency. Deleted/replaced by real Consent in
 * Sprint-04. Grep-able by design: AllowAllConsentService.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class AllowAllConsentService implements ExternalConsentService {
  /**
   * Always resolves true regardless of the person.
   * @param _personId Ignored person id.
   */
  async mayContactNow(_personId: string): Promise<boolean> {
    return true;
  }
}
