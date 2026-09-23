import { Inject, Injectable } from "@nestjs/common";
import { IAM_CONTEXT_FACADE } from "../../../iam/interfaces/acl/iam-context.facade.js";
import type { IamContextFacade } from "../../../iam/interfaces/acl/iam-context.facade.js";
import type { ExternalIamService } from "../../application/internal/outboundservices/acl/external-iam.service.js";

/**
 * ACL adapter through which Verification consumes the published IAM facade.
 * Primitives cross the boundary both ways; IAM's value objects never enter
 * this context. Existence is answered by standing: unknown persons yield no
 * answer, every known standing (even REGISTERED) yields one.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ExternalIamServiceImpl implements ExternalIamService {
  /**
   * Wires the adapter over the published IAM facade token.
   * @param iam Facade published by IamModule (R9/R13).
   */
  constructor(@Inject(IAM_CONTEXT_FACADE) private readonly iam: IamContextFacade) {}

  /**
   * Answers whether IAM holds a record for the person.
   * @param personId Person id (`per-` prefixed string).
   */
  async personExists(personId: string): Promise<boolean> {
    return (await this.iam.answerAccessStanding(personId)) !== null;
  }

  /**
   * Forwards the email-verification confirmation fact to IAM.
   * @param personId Person id (`per-` prefixed string).
   */
  async markVerified(personId: string): Promise<void> {
    await this.iam.markVerified(personId);
  }
}
