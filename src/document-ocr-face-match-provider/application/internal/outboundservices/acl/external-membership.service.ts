import { Inject, Injectable } from "@nestjs/common";
import { MEMBERSHIP_CONTEXT_FACADE, type MembershipContextFacade } from "../../../../../membership/interfaces/acl/membership-context.facade.js";

/**
 * Outbound ACL toward Membership (R8, Conformist): the belonging
 * precondition is answered outside; OCR checks, Membership judges. OCR
 * never judges membership itself.
 */
@Injectable()
export class ExternalMembershipService {
  constructor(@Inject(MEMBERSHIP_CONTEXT_FACADE) private readonly facade: MembershipContextFacade) {}

  /**
   * Answers whether the person holds a live membership anywhere now.
   * @param personId Person id (`per-` prefixed string).
   */
  async belongsToAnyCommunity(personId: string): Promise<boolean> {
    return this.facade.belongsToAnyCommunity(personId);
  }
}
