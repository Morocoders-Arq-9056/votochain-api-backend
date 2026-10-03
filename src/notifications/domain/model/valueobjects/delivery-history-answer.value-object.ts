import type { DeliveryAttempt } from "./delivery-attempt.value-object.js";
import { DispatchId } from "./dispatch-id.value-object.js";

/**
 * Read-model answer to the delivery-history question: the full append-only
 * attempt list of one dispatch, for scrutiny and erasure consumers.
 * Mutates nothing, produces no facts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryHistoryAnswer {

  /**
   * Creates a new DeliveryHistoryAnswer instance.
   *
   * @param dispatchId Identity of the dispatch being answered.
   * @param attempts The full attempt list, oldest first.
   */
  constructor(
    public readonly dispatchId: DispatchId,
    public readonly attempts: DeliveryAttempt[],
  ) {
    if (!dispatchId) throw new Error('dispatchId required');
  }
}
