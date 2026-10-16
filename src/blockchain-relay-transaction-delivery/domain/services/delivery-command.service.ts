import type { AcceptDeliveryOrderCommand, DeliverOrderCommand, RecordDeliveryOrderLedgerOutcomeCommand } from "../model/commands/delivery.commands.js";
import type { DeliveryOrderId } from "../model/valueobjects/delivery-order-id.value-object.js";

export const DELIVERY_COMMAND_SERVICE = Symbol('DELIVERY_COMMAND_SERVICE');

export interface DeliveryCommandService {
  acceptDeliveryOrder(cmd: AcceptDeliveryOrderCommand): Promise<DeliveryOrderId>;
  deliverOrder(cmd: DeliverOrderCommand): Promise<void>;
  recordDeliveryOrderLedgerOutcome(cmd: RecordDeliveryOrderLedgerOutcomeCommand): Promise<void>;
}
