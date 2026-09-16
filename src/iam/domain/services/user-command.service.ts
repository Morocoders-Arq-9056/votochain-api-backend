import { SignUpCommand } from "../model/commands/sign-up.command.js";
import { UserId } from "../model/valueobjects/user-id.value-object.js";

/**
 * Interface for the user command service.
 * This service is responsible for handling commands related to user actions.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export interface UserCommandService {
  /**
   * Handles the user sign-up process.
   * The command carries only the contact address; UserId and PersonId are minted
   * inside the User.signup factory. Email uniqueness is checked in application.
   *
   * @param command The command containing the contact address for signing up a user.
   * @returns A promise that resolves to the newly created UserId.
   */
  signUp(command: SignUpCommand): Promise<UserId>;
}
export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');
