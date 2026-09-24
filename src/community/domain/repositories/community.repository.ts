import { Community } from "../model/aggregates/community.aggregate.js";
import { CommunityId } from "../model/valueobjects/community-id.value-object.js";

/**
 * Interface for the community repository.
 * This repository is responsible for managing community data persistence and retrieval.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export interface CommunityRepository {
  /**
   * Finds a community by its unique identifier.
   *
   * @param id The unique identifier of the community to find.
   * @returns A promise that resolves to the Community if found, or null if not found.
   */
  findById(id: CommunityId): Promise<Community | null>;

  /**
   * Finds a community by its name.
   *
   * @param name The name of the community to find.
   * @returns A promise that resolves to the Community if found, or null if not found.
   */
  findByName(name: string): Promise<Community | null>;

  /**
   * Saves a community entity to the repository.
   *
   * @param community The community entity to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(community: Community): Promise<void>;
}
export const COMMUNITY_REPOSITORY = Symbol('COMMUNITY_REPOSITORY');
