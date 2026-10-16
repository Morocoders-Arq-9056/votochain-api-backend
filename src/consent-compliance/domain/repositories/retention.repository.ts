import type { RetentionPolicy } from "../model/aggregates/retention-policy.aggregate.js";
import type { DataCategory } from "../model/valueobjects/data-category.value-object.js";

export const RETENTION_REPOSITORY = Symbol('RETENTION_REPOSITORY');

export interface RetentionRepository {
  findLatestByCategory(category: DataCategory): Promise<RetentionPolicy | null>;
  save(policy: RetentionPolicy): Promise<void>;
}
