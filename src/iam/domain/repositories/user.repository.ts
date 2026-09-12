import { User } from "../model/aggregates/user.aggregate.js";

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
   * @param id The unique identifier of the user to find.
   * @returns A promise that resolves to the User if found, or null if not found.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Saves a user entity to the repository.
   * @param user The user entity to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(user: User): Promise<void>;
}
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');