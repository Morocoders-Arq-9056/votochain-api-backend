import { User } from "../model/aggregates/user.aggregate.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";
import { UserId } from "../model/valueobjects/user-id.value-object.js";

/**
 * Interface for the user repository.
 * This repository is responsible for managing user data persistence and retrieval.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export interface UserRepository {
  /**
   * Finds a user by their unique identifier.
   * 
   * @param id The unique identifier of the user to find.
   * @returns A promise that resolves to the User if found, or null if not found.
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Finds a user by their email address.
   * 
   * @param email The email address of the user to find.
   * @returns A promise that resolves to the User if found, or null if not found.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Finds a user by their associated person ID.
   * 
   * @param personId The person ID associated with the user to find.
   * @returns A promise that resolves to the User if found, or null if not found.
   */
  findByPersonId(personId: PersonId): Promise<User | null>;

  /**
   * Saves a user entity to the repository.
   * 
   * @param user The user entity to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(user: User): Promise<void>;
}
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');