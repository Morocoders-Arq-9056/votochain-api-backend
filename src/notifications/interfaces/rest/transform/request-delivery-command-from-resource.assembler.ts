import { DeliveryAddress } from "../../../domain/model/valueobjects/delivery-address.value-object.js";
import { IdempotencyKey } from "../../../domain/model/valueobjects/idempotency-key.value-object.js";
import { RequestNotificationDeliveryCommand } from "../../../domain/model/commands/request-notification-delivery.command.js";
import { RequestDeliveryResource } from "../resources/request-delivery.resource.js";

/**
 * Assembles a RequestNotificationDeliveryCommand from its resource.
 * Thin translation only: value objects validate at construction.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RequestDeliveryCommandFromResourceAssembler {
  /**
   * Translates the inbound resource into the command object.
   * @param resource The inbound delivery intent resource.
   */
  static toCommand(resource: RequestDeliveryResource): RequestNotificationDeliveryCommand {
    return new RequestNotificationDeliveryCommand(
      IdempotencyKey.of(resource.key),
      DeliveryAddress.of(resource.address),
      resource.templateKey,
      resource.templateValues ?? {},
      resource.reason,
    );
  }
}
