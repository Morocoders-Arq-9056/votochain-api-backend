import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";

/**
 * Query reading the full attempt history of one dispatch (scrutiny).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetDeliveryHistoryByDispatchQuery {
  constructor(public readonly dispatchId: DispatchId) {
    if (!dispatchId) throw new Error('dispatchId required');
  }
}
