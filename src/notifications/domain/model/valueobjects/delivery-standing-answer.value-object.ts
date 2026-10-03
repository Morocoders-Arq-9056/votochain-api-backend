import type { DispatchStanding } from "./dispatch-standing.value-object.js";
import { DispatchId } from "./dispatch-id.value-object.js";

/**
 * Read-model answer to the delivery-standing question: current standing plus
 * how many attempts were recorded and the refusal cause when refused.
 * Mutates nothing, produces no facts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryStandingAnswer {

  /**
   * Creates a new DeliveryStandingAnswer instance.
   *
   * @param dispatchId Identity of the dispatch being answered.
   * @param standing Current standing: REQUESTED | REFUSED | CONFIRMED | FAILED.
   * @param attempts How many attempts the history holds.
   * @param refusal Refusal cause when REFUSED, null otherwise.
   */
  constructor(
    public readonly dispatchId: DispatchId,
    public readonly standing: DispatchStanding,
    public readonly attempts: number,
    public readonly refusal: string | null,
  ) {
    if (!dispatchId) throw new Error('dispatchId required');
  }
}
