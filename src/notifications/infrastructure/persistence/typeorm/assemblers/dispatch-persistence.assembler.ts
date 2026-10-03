import { Injectable } from "@nestjs/common";
import { NotificationDispatch } from "../../../../domain/model/aggregates/notification-dispatch.aggregate.js";
import { parseDispatchStanding } from "../../../../domain/model/valueobjects/dispatch-standing.value-object.js";
import { DeliveryAddress } from "../../../../domain/model/valueobjects/delivery-address.value-object.js";
import type { DeliveryAttempt } from "../../../../domain/model/valueobjects/delivery-attempt.value-object.js";
import { DispatchId } from "../../../../domain/model/valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../../../../domain/model/valueobjects/idempotency-key.value-object.js";
import { RefusalReason } from "../../../../domain/model/valueobjects/refusal-reason.value-object.js";
import { ResolvedTemplate } from "../../../../domain/model/valueobjects/resolved-template.value-object.js";
import { DispatchOrmEntity } from "../entities/dispatch.orm-entity.js";

/**
 * Stored history-attempt node: every field validated before the node is
 * trusted, so a corrupt row throws where the corruption happened.
 */
interface AttemptNode {
  at: string;
  outcome: string;
  detail?: string;
}

/**
 * Structural guard for a stored history-attempt node.
 */
function isAttemptNode(json: unknown): json is AttemptNode {
  if (typeof json !== 'object' || json === null) return false;
  const node = json as Record<string, unknown>;
  return typeof node['at'] === 'string'
    && typeof node['outcome'] === 'string'
    && (node['detail'] === undefined || typeof node['detail'] === 'string');
}

/**
 * Translates between the `NotificationDispatch` domain aggregate and its
 * persistence shape. Domain → ORM reads everything off
 * the aggregate; ORM → domain parses every string through explicit parsers
 * (never `as`), so a corrupt row throws where the corruption happened.
 * History entries map one by one (`at` ISO string ↔ Date); the refusal
 * maps through `RefusalReason` only when present.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class DispatchPersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: DispatchOrmEntity): NotificationDispatch {
    return NotificationDispatch.rehydrate({
      id: DispatchId.of(entity.id),
      key: IdempotencyKey.of(entity.idempotencyKey),
      address: DeliveryAddress.of(entity.address),
      template: ResolvedTemplate.of(entity.templateKey, entity.templateValues ?? {}),
      reason: entity.reason,
      standing: parseDispatchStanding(entity.standing),
      history: (entity.history ?? []).map((h) => this.toAttempt(h)),
      refusal: entity.refusal ? RefusalReason.of(entity.refusal) : null,
    });
  }

  /**
   * Rebuilds one history attempt from its stored shape.
   * @param json The stored attempt node.
   */
  private toAttempt(json: unknown): DeliveryAttempt {
    if (!isAttemptNode(json)) throw new Error('invalid delivery attempt');
    return { at: new Date(json.at), outcome: parseDispatchStanding(json.outcome), ...(json.detail !== undefined ? { detail: json.detail } : {}) };
  }

  /**
   * Renders the persistence row straight from the aggregate being saved.
   * Nothing enters the row that did not come from the domain object.
   * @param dispatch The aggregate to persist.
   */
  toOrmFromDomain(dispatch: NotificationDispatch): DispatchOrmEntity {
    const ormEntity = new DispatchOrmEntity();
    ormEntity.id = dispatch.id.value;
    ormEntity.idempotencyKey = dispatch.key.value;
    ormEntity.address = dispatch.address.value;
    ormEntity.channel = 'EMAIL';
    ormEntity.templateKey = dispatch.template.key;
    ormEntity.templateValues = { ...dispatch.template.values };
    ormEntity.reason = dispatch.reason;
    ormEntity.standing = dispatch.standing;
    ormEntity.history = dispatch.history.map((a) => ({
      at: a.at.toISOString(),
      outcome: a.outcome,
      ...(a.detail !== undefined ? { detail: a.detail } : {}),
    }));
    ormEntity.refusal = dispatch.refusal ? dispatch.refusal.value : null;
    return ormEntity;
  }
}
