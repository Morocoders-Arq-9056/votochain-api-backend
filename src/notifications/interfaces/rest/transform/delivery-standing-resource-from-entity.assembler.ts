import { DeliveryStandingAnswer } from "../../../domain/model/valueobjects/delivery-standing-answer.value-object.js";
import { DeliveryStandingResource } from "../resources/delivery-standing.resource.js";

/**
 * Assembles a DeliveryStandingResource from its read-model answer.
 * Thin translation only: no business rules at the boundary.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryStandingResourceFromEntityAssembler {
  /**
   * Translates the standing answer into the outbound resource.
   * @param answer The read-model standing answer.
   */
  static toResource(answer: DeliveryStandingAnswer): DeliveryStandingResource {
    return new DeliveryStandingResource(answer.dispatchId.value, answer.standing, answer.attempts, answer.refusal);
  }
}
