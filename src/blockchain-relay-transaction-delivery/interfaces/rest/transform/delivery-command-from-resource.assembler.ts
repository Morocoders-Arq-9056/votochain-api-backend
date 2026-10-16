import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { AcceptDeliveryOrderCommand } from "../../../domain/model/commands/delivery.commands.js";
import { GetDeliveryAttemptHistoryByOrderQuery, GetDeliveryOrderStandingByIdQuery, GetDeliverySendingOrderByPayerQuery } from "../../../domain/model/queries/delivery.queries.js";
import { DeliveryOrderId } from "../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { PayerRef } from "../../../domain/model/valueobjects/payer-ref.value-object.js";
import type { AcceptDeliveryResource } from "../resources/delivery.resource.js";

export class AcceptDeliveryCommandFromResourceAssembler {
  static toCommand(r: AcceptDeliveryResource): AcceptDeliveryOrderCommand {
    return new AcceptDeliveryOrderCommand(
      SignedContentRef.of(r.contentRef),
      PayerRef.of(r.payerRef),
      r.signedProof,
    );
  }
}

export class DeliveryParamsAssembler {
  static toOrderId(id: string): DeliveryOrderId { return DeliveryOrderId.of(id); }
  static toPayerRef(payer: string): PayerRef { return PayerRef.of(payer); }
  static toStandingQuery(id: string): GetDeliveryOrderStandingByIdQuery {
    return new GetDeliveryOrderStandingByIdQuery(DeliveryOrderId.of(id));
  }
  static toSendingOrderQuery(payer: string): GetDeliverySendingOrderByPayerQuery {
    return new GetDeliverySendingOrderByPayerQuery(PayerRef.of(payer));
  }
  static toAttemptHistoryQuery(id: string): GetDeliveryAttemptHistoryByOrderQuery {
    return new GetDeliveryAttemptHistoryByOrderQuery(DeliveryOrderId.of(id));
  }
}
