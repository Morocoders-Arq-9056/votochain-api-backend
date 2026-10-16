import { Inject, Injectable } from "@nestjs/common";
import { IAM_CONTEXT_FACADE } from "../../../../../iam/interfaces/acl/iam-context.facade.js";
import type { IamContextFacade } from "../../../../../iam/interfaces/acl/iam-context.facade.js";

/**
 * Outbound ACL toward IAM: a wallet is provisioned for a real person only.
 */
@Injectable()
export class ExternalIamService {
  constructor(@Inject(IAM_CONTEXT_FACADE) private readonly iam: IamContextFacade) {}

  /**
   * Answers whether IAM holds a record for the person.
   * @param personId Person id (`per-` prefixed string).
   */
  async personExists(personId: string): Promise<boolean> {
    return (await this.iam.answerAccessStanding(personId)) !== null;
  }
}
