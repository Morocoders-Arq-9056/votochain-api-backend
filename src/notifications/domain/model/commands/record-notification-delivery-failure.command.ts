import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";

/**
 * Command recording an executor-observed delivery failure (UC3 webhook).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RecordNotificationDeliveryFailureCommand {
  constructor(
    public readonly dispatchId: DispatchId,
    public readonly reason: FailureReason,
  ) {
    if (!dispatchId) throw new Error('dispatchId required');
    if (!reason) throw new Error('reason required');
  }
}
