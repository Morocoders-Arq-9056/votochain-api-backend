import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DeliveryAddress } from "../valueobjects/delivery-address.value-object.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";
import { ResolvedTemplate } from "../valueobjects/resolved-template.value-object.js";

/**
 * Event emitted when a delivery intent is requested.
 *
 * Carries dispatch id, key, template, address and reason — never person identity.
 * The in-module handler instructs the executor outside the boundary.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryRequestedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryRequested';
  readonly eventName = DeliveryRequestedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly key: IdempotencyKey,
    public readonly address: DeliveryAddress,
    public readonly template: ResolvedTemplate,
    public readonly reason: string,
  ) {}
}
