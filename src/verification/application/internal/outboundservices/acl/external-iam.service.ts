import { Inject, Injectable } from "@nestjs/common";
import { IAM_CONTEXT_FACADE } from "../../../../../iam/interfaces/acl/iam-context.facade.js";
import type { IamContextFacade } from "../../../../../iam/interfaces/acl/iam-context.facade.js";

/**
 * Outbound ACL through which Verification checks identity existence and
 * publishes confirmation facts to IAM (R9). Primitives-only at the
 * boundary; this context never imports IAM's value objects. Existence is
 * answered by standing: unknown persons yield no answer, every known
 * standing (even REGISTERED) yields one.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ExternalIamService {
  /**
   * Wires the consumer over the published IAM facade token.
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
   * Forwards the email-verification confirmation fact to IAM (fact-only,
   * never secret).
   * @param personId Person id (`per-` prefixed string).
   */
  async markVerified(personId: string): Promise<void> {
    await this.iam.markVerified(personId);
  }

  /**
   * Resolves a contact address into its person id for pre-login flows.
   * @param email Raw contact address.
   */
  async personIdForEmail(email: string): Promise<string | null> {
    return this.iam.personIdForEmail(email);
  }

  /**
   * Rotates the local secret of the person's identity (recovery reset).
   * @param personId Person id (`per-` prefixed string).
   * @param newSecret New secret reference (never logged, never returned).
   */
  async resetSecret(personId: string, newSecret: string): Promise<void> {
    await this.iam.resetSecret(personId, newSecret);
  }
}
