import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";

/**
 * Query answering the delivery standing of one dispatch by id (UC5).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetDeliveryStandingByDispatchQuery {
  constructor(public readonly dispatchId: DispatchId) {
    if (!dispatchId) throw new Error('dispatchId required');
  }
}
