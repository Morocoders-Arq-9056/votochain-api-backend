import { NotificationDispatch } from "../model/aggregates/notification-dispatch.aggregate.js";
import { DispatchId } from "../model/valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../model/valueobjects/idempotency-key.value-object.js";
import { PersonReference } from "../model/valueobjects/person-reference.value-object.js";

/**
 * Repository port for the NotificationDispatch aggregate.
 * Finders are named in ubiquitous language and deal in whole aggregates.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface NotificationDispatchRepository {
  /**
   * Finds a dispatch by its idempotency key (duplicate fast-path).
   *
   * @param key The requester-supplied idempotency key.
   * @returns A promise resolving to the dispatch, or null when unseen.
   */
  findByKey(key: IdempotencyKey): Promise<NotificationDispatch | null>;

  /**
   * Finds a dispatch by its identity.
   *
   * @param id The dispatch id.
   * @returns A promise resolving to the dispatch, or null when unknown.
   */
  findById(id: DispatchId): Promise<NotificationDispatch | null>;

  /**
   * Finds every dispatch whose render values carry the person's reference
   * (erasure scan; matched in storage on the `templateValues` jsonb).
   * @param person Local person reference to look for.
   */
  findReferencingPerson(person: PersonReference): Promise<NotificationDispatch[]>;

  /**
   * Persists the whole aggregate state in one row.
   *
   * @param dispatch The dispatch aggregate to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(dispatch: NotificationDispatch): Promise<void>;
}
/**
 * Injection token for the {@link NotificationDispatchRepository} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const NOTIFICATION_DISPATCH_REPOSITORY = Symbol('NOTIFICATION_DISPATCH_REPOSITORY');
