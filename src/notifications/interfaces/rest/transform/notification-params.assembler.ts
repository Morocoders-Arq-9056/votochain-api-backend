import { DispatchId } from "../../../domain/model/valueobjects/dispatch-id.value-object.js";
import { FailureReason } from "../../../domain/model/valueobjects/failure-reason.value-object.js";
import { IdempotencyKey } from "../../../domain/model/valueobjects/idempotency-key.value-object.js";
import { DispatchNotFoundError } from "../../../domain/exceptions/dispatch-not-found.error.js";
import { NoSendInstructedError } from "../../../domain/exceptions/no-send-instructed.error.js";

/**
 * Parses Notifications boundary strings into domain value objects.
 * Corrupt input raises domain rejections so the exception filter maps them.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-29
 */
export class NotificationParamsAssembler {
  static toDispatchId(id: string): DispatchId {
    try {
      return DispatchId.of(id);
    } catch {
      throw new DispatchNotFoundError('dispatch not found');
    }
  }

  static toIdempotencyKey(key: string): IdempotencyKey {
    try {
      return IdempotencyKey.of(key);
    } catch {
      throw new DispatchNotFoundError('dispatch not found for key');
    }
  }

  static toFailureReason(reason: string): FailureReason {
    try {
      return FailureReason.of(reason);
    } catch {
      throw new NoSendInstructedError('failure reason required');
    }
  }
}
