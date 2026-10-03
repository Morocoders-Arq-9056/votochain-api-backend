import { Inject, Injectable } from "@nestjs/common";
import { IAM_CONTEXT_FACADE } from "../../../../../iam/interfaces/acl/iam-context.facade.js";
import type { IamContextFacade } from "../../../../../iam/interfaces/acl/iam-context.facade.js";

/**
 * Outbound ACL through which Community checks identity existence in IAM
 * (UC5: an administrator is entrusted to a real person; only the reference
 * is held). Primitives-only at the boundary; this context never imports
 * IAM's value objects. Existence is answered by standing: unknown persons
 * yield no answer, every known standing (even REGISTERED) yields one.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class ExternalIamService {
  /**
   * Wires the consumer over the published IAM facade token.
   * @param iam Facade published by IamModule (UC5 identity reference).
   */
  constructor(@Inject(IAM_CONTEXT_FACADE) private readonly iam: IamContextFacade) {}

  /**
   * Answers whether IAM holds a record for the person.
   * @param personId Person id (`per-` prefixed string).
   */
  async personExists(personId: string): Promise<boolean> {
    return (await this.iam.answerAccessStanding(personId)) !== null;
  }
}
