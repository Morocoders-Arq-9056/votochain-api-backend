import { GetAccessStandingByPersonQuery } from "../model/queries/get-access-standing-by-person.query.js";
import { GetUserByEmailQuery } from "../model/queries/get-user-by-email.query.js";
import { GetUserByIdQuery } from "../model/queries/get-user-by-id.query.js";
import { User } from "../model/aggregates/user.aggregate.js"
import { GetSystemRolesByPersonQuery } from "../model/queries/get-system-roles-by-person.query.js";
import type { SystemRole } from "../model/valueobjects/system-role.value-object.js";
import type { AccessStandingAnswer } from "../model/valueobjects/access-standing-answer.value-object.js";

/**
 * Interface for the user query service.
 * This service is responsible for handling queries related to user information.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export interface UserQueryService {
  /**
   * Handles the retrieval of a User by its identifier. 
   * @param query the query containing the user identifier.
   * @returns a promise that resolves to the User if found, or null if not found.
   */
  getUserById(query: GetUserByIdQuery): Promise<User | null>;

  /**
   * Handles the retrieval of a User by their contact address.
   * Lets inbound adapters resolve the identity callers actually know (email)
   * into the technical id the commands require; unknown addresses yield null.
   * @param query the query containing the email address.
   * @returns a promise that resolves to the User if found, or null if not found.
   */
  getUserByEmail(query: GetUserByEmailQuery): Promise<User | null>;

  /**
   * Answers the access standing of a User by their associated person identifier.
   * @param query the query containing the person identifier.
   * @returns a promise that resolves to the access standing answer if found, or null if not found.
   */
  getAccessStandingByPerson(query: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer | null>;

  /**
   * Handles the retrieval of system roles associated with a person.
   * @param query the query containing the person identifier.
   * @returns a promise that resolves to an array of SystemRole values.
   */
  getSystemRolesByPerson(query: GetSystemRolesByPersonQuery): Promise<SystemRole[]>;
}
export const USER_QUERY_SERVICE = Symbol('USER_QUERY_SERVICE');
