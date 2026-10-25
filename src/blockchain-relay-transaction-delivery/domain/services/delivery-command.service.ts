import type { AcceptDeliveryOrderCommand } from "../model/commands/accept-delivery-order.command.js";
import type { DeliverOrderCommand } from "../model/commands/deliver-order.command.js";
import type { RecordDeliveryOrderLedgerOutcomeCommand } from "../model/commands/record-delivery-order-ledger-outcome.command.js";
import type { DeliveryOrderId } from "../model/valueobjects/delivery-order-id.value-object.js";

export const DELIVERY_COMMAND_SERVICE = Symbol('DELIVERY_COMMAND_SERVICE');

export interface DeliveryCommandService {
  acceptDeliveryOrder(cmd: AcceptDeliveryOrderCommand): Promise<DeliveryOrderId>;
  deliverOrder(cmd: DeliverOrderCommand): Promise<void>;
  recordDeliveryOrderLedgerOutcome(cmd: RecordDeliveryOrderLedgerOutcomeCommand): Promise<void>;
}
