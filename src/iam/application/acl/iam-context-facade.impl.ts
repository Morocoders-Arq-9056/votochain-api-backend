import { Inject, Injectable } from "@nestjs/common";
import { USER_QUERY_SERVICE } from "../../domain/services/user-query.service.js";
import type { UserQueryService } from "../../domain/services/user-query.service.js";
import { USER_COMMAND_SERVICE } from "../../domain/services/user-command.service.js";
import type { UserCommandService } from "../../domain/services/user-command.service.js";
import { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { GetAccessStandingByPersonQuery } from "../../domain/model/queries/get-access-standing-by-person.query.js";
import { GetSystemRolesByPersonQuery } from "../../domain/model/queries/get-system-roles-by-person.query.js";
import { GetUserByEmailQuery } from "../../domain/model/queries/get-user-by-email.query.js";
import { GetUserByPersonIdQuery } from "../../domain/model/queries/get-user-by-person-id.query.js";
import { ChangeSecretCommand } from "../../domain/model/commands/change-secret.command.js";
import { VerifyEmailCommand } from "../../domain/model/commands/verify-email.command.js";
import type { AccessStandingAnswerDto, IamContextFacade } from "../../interfaces/acl/iam-context.facade.js";

/**
 * Application implementation of the published {@link IamContextFacade}.
 * Translates primitive boundary strings into domain VOs, delegates to the
 * query/command services, and translates back to primitives. Reception point
 * for R9: Verification calls markVerified, never subscribes across modules.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class IamContextFacadeImpl implements IamContextFacade {
  /**
   * Wires the facade over query/command services only. Inbound ACLs never
   * touch repositories directly: user resolution runs through the query side.
   * @param queries Read-only query service.
   * @param commands Write command service.
   */
  constructor(
    @Inject(USER_QUERY_SERVICE) private readonly queries: UserQueryService,
    @Inject(USER_COMMAND_SERVICE) private readonly commands: UserCommandService,
  ) {}

  /**
   * Answers access standing for the given person id string.
   * @param personId Person id (`per-` prefixed string).
   */
  async answerAccessStanding(personId: string): Promise<AccessStandingAnswerDto | null> {
    const answer = await this.queries.getAccessStandingByPerson(
      new GetAccessStandingByPersonQuery(PersonId.of(personId)),
    );
    return answer ? { mayAct: answer.mayAct, roles: [...answer.roles], sessionOpen: answer.sessionOpen } : null;
  }

  /**
   * Lists system roles for the given person id string.
   * @param personId Person id (`per-` prefixed string).
   */
  async getSystemRoles(personId: string): Promise<string[]> {
    return this.queries.getSystemRolesByPerson(new GetSystemRolesByPersonQuery(PersonId.of(personId)));
  }

  /**
   * Records the observed email confirmation for the recorded address.
   * Resolves the user by personId, then dispatches VerifyEmailCommand.
   * @param personId Person id (`per-` prefixed string).
   */
  async markVerified(personId: string): Promise<void> {
    const user = await this.queries.getUserByPersonId(new GetUserByPersonIdQuery(PersonId.of(personId)));
    if (!user) return;
    await this.commands.verifyEmail(new VerifyEmailCommand(user.id));
  }

  /**
   * Resolves a contact address into its person id for pre-login flows.
   * @param email Raw contact address.
   */
  async personIdForEmail(email: string): Promise<string | null> {
    const user = await this.queries.getUserByEmail(new GetUserByEmailQuery(email));
    return user ? user.personId.value : null;
  }

  async getEmailByPersonId(personId: string): Promise<string | null> {
    const user = await this.queries.getUserByPersonId(new GetUserByPersonIdQuery(PersonId.of(personId)));
    return user ? user.contact.email : null;
  }

  async resetSecret(personId: string, newSecret: string): Promise<void> {
    const user = await this.queries.getUserByPersonId(new GetUserByPersonIdQuery(PersonId.of(personId)));
    if (!user) return;
    await this.commands.changeSecret(new ChangeSecretCommand(user.id, newSecret));
  }
}
