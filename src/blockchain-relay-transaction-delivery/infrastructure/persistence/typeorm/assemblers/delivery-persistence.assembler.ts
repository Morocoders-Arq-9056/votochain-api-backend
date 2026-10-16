import { Injectable } from "@nestjs/common";
import { SignedContentRef } from "../../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { DeliveryOrder } from "../../../../domain/model/aggregates/delivery-order.aggregate.js";
import { SendingAttempt } from "../../../../domain/model/entities/sending-attempt.entity.js";
import { parseAttemptOutcome } from "../../../../domain/model/valueobjects/attempt-outcome.value-object.js";
import { DeliveryOrderId } from "../../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { parseDeliveryStanding } from "../../../../domain/model/valueobjects/delivery-standing.value-object.js";
import { FailureReason } from "../../../../domain/model/valueobjects/failure-reason.value-object.js";
import { PayerRef } from "../../../../domain/model/valueobjects/payer-ref.value-object.js";
import { SendingOrderPosition } from "../../../../domain/model/valueobjects/sending-order-position.value-object.js";
import { DeliveryOrderOrmEntity, SendingAttemptOrmEntity } from "../entities/delivery.orm-entities.js";

/**
 * Translates between the `DeliveryOrder` aggregate (+ child attempts table)
 * and its rows. Closed sets go through `parse*` (never `as`).
 */
@Injectable()
export class DeliveryPersistenceAssembler {
  toDomain(orm: DeliveryOrderOrmEntity): DeliveryOrder {
    const attempts = (orm.attempts ?? [])
      .slice()
      .sort((a, b) => a.attemptNo - b.attemptNo)
      .map((a) => {
        parseAttemptOutcome(a.outcome);
        return a.outcome === 'SENT'
          ? SendingAttempt.createSent(a.attemptNo)
          : SendingAttempt.createFailed(a.attemptNo, FailureReason.of(a.reason ?? 'LEDGER_REJECTED'));
      });
    return DeliveryOrder.rehydrate(
      DeliveryOrderId.of(orm.id),
      SignedContentRef.of(orm.contentRef),
      PayerRef.of(orm.payerRef),
      SendingOrderPosition.of(orm.orderPosition),
      parseDeliveryStanding(orm.standing),
      attempts,
    );
  }

  toOrm(domain: DeliveryOrder): DeliveryOrderOrmEntity {
    const orm = new DeliveryOrderOrmEntity();
    orm.id = domain.id.value;
    orm.contentRef = domain.contentRef.value;
    orm.payerRef = domain.payerRef.value;
    orm.orderPosition = domain.orderPosition.value;
    orm.standing = domain.standing;
    orm.attempts = domain.attempts.map((a) => {
      const row = new SendingAttemptOrmEntity();
      row.id = `${domain.id.value}:${a.nro}`;
      row.attemptNo = a.nro;
      row.outcome = a.outcome;
      row.reason = a.reason?.value ?? null;
      return row;
    });
    return orm;
  }
}
