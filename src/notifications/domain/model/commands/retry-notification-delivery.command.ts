import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";

/**
 * Command retrying a failed dispatch (UC4). FAILED only: CONFIRMED/REFUSED
 * never retry. Retries append on the same dispatch, re-entering REQUESTED.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RetryNotificationDeliveryCommand {
  constructor(public readonly dispatchId: DispatchId) {
    if (!dispatchId) throw new Error('dispatchId required');
  }
}
