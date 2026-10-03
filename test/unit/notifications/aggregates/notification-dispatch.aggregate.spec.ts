import { NotificationDispatch } from '../../../../src/notifications/domain/model/aggregates/notification-dispatch.aggregate.js';
import { DeliveryAddress } from '../../../../src/notifications/domain/model/valueobjects/delivery-address.value-object.js';
import { DispatchId } from '../../../../src/notifications/domain/model/valueobjects/dispatch-id.value-object.js';
import { FailureReason } from '../../../../src/notifications/domain/model/valueobjects/failure-reason.value-object.js';
import { IdempotencyKey } from '../../../../src/notifications/domain/model/valueobjects/idempotency-key.value-object.js';
import { RefusalReason } from '../../../../src/notifications/domain/model/valueobjects/refusal-reason.value-object.js';
import { ResolvedTemplate } from '../../../../src/notifications/domain/model/valueobjects/resolved-template.value-object.js';
import { DeliveryRequestedEvent } from '../../../../src/notifications/domain/model/events/delivery-requested.event.js';
import { DeliveryRefusedEvent } from '../../../../src/notifications/domain/model/events/delivery-refused.event.js';
import { DeliveryConfirmedEvent } from '../../../../src/notifications/domain/model/events/delivery-confirmed.event.js';
import { DeliveryFailedEvent } from '../../../../src/notifications/domain/model/events/delivery-failed.event.js';
import { DeliveryRetriedEvent } from '../../../../src/notifications/domain/model/events/delivery-retried.event.js';
import { AddressMalformedError } from '../../../../src/notifications/domain/exceptions/address-malformed.error.js';
import { AlreadyConfirmedError } from '../../../../src/notifications/domain/exceptions/already-confirmed.error.js';
import { ContactNotAllowedError } from '../../../../src/notifications/domain/exceptions/contact-not-allowed.error.js';
import { DuplicateIntentError } from '../../../../src/notifications/domain/exceptions/duplicate-intent.error.js';
import { NoSendInstructedError } from '../../../../src/notifications/domain/exceptions/no-send-instructed.error.js';
import { RetryNotAllowedError } from '../../../../src/notifications/domain/exceptions/retry-not-allowed.error.js';

function deliveryParts() {
  return {
    id: DispatchId.generate(),
    key: IdempotencyKey.of('intent-1'),
    address: DeliveryAddress.of('ada@votachain.dev'),
    template: ResolvedTemplate.of('welcome', { name: 'Ada' }),
  };
}

function requestedDispatch(): NotificationDispatch {
  const d = NotificationDispatch.requestDelivery({ ...deliveryParts(), reason: 'welcome' });
  d.pullDomainEvents();
  return d;
}

describe('NotificationDispatch aggregate', () => {
  it('requests delivery as REQUESTED with a DeliveryRequestedEvent', () => {
    const d = NotificationDispatch.requestDelivery({ ...deliveryParts(), reason: 'welcome' });

    expect(d.standing).toBe('REQUESTED');
    expect(d.answerDeliveryStanding()).toEqual({ standing: 'REQUESTED', attempts: 1, refusal: null });

    const events = d.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DeliveryRequestedEvent);
  });

  it('refuses a duplicate intent as REFUSED with a DeliveryRefusedEvent', () => {
    const p = deliveryParts();
    const d = NotificationDispatch.refuse({ ...p, reason: RefusalReason.of('DUPLICATE') });

    expect(d.standing).toBe('REFUSED');
    expect(d.answerDeliveryStanding()).toEqual({ standing: 'REFUSED', attempts: 1, refusal: 'DUPLICATE' });

    const events = d.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DeliveryRefusedEvent);
  });

  it('refuseAndThrow returns the refused dispatch plus DuplicateIntentError for DUPLICATE', () => {
    const p = deliveryParts();
    const { dispatch, error } = NotificationDispatch.refuseAndThrow({ ...p, reasonCode: 'DUPLICATE' });

    expect(dispatch.standing).toBe('REFUSED');
    expect(dispatch.answerDeliveryStanding().refusal).toBe('DUPLICATE');
    expect(error).toBeInstanceOf(DuplicateIntentError);
    expect(dispatch.pullDomainEvents()[0]).toBeInstanceOf(DeliveryRefusedEvent);
  });

  it('refuseAndThrow returns the refused dispatch plus ContactNotAllowedError for CONTACT_NOT_ALLOWED', () => {
    const p = deliveryParts();
    const { dispatch, error } = NotificationDispatch.refuseAndThrow({ ...p, reasonCode: 'CONTACT_NOT_ALLOWED' });

    expect(dispatch.standing).toBe('REFUSED');
    expect(dispatch.answerDeliveryStanding().refusal).toBe('CONTACT_NOT_ALLOWED');
    expect(error).toBeInstanceOf(ContactNotAllowedError);
  });

  it('confirms a requested dispatch and refuses a second confirm', () => {
    const d = requestedDispatch();

    d.confirmDelivered();
    expect(d.standing).toBe('CONFIRMED');
    expect(d.answerDeliveryStanding().standing).toBe('CONFIRMED');

    const events = d.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DeliveryConfirmedEvent);

    expect(() => d.confirmDelivered()).toThrow(AlreadyConfirmedError);
  });

  it('records a delivery failure as FAILED with a DeliveryFailedEvent', () => {
    const d = requestedDispatch();

    d.recordDeliveryFailure(FailureReason.of('bounce'));
    expect(d.standing).toBe('FAILED');
    expect(d.answerDeliveryStanding().attempts).toBe(2);

    const events = d.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DeliveryFailedEvent);
  });

  it('refuses a delivery failure when not REQUESTED', () => {
    const d = requestedDispatch();
    d.confirmDelivered();
    d.pullDomainEvents();

    expect(() => d.recordDeliveryFailure(FailureReason.of('bounce'))).toThrow(NoSendInstructedError);
  });

  it('retries a failed dispatch back to REQUESTED and appends history', () => {
    const d = requestedDispatch();
    const attemptsBefore = d.answerDeliveryStanding().attempts;
    d.recordDeliveryFailure(FailureReason.of('timeout'));
    d.pullDomainEvents();

    d.requestRetry();
    expect(d.standing).toBe('REQUESTED');
    expect(d.answerDeliveryStanding().attempts).toBe(attemptsBefore + 2);
    expect(d.history).toHaveLength(d.answerDeliveryStanding().attempts);

    const events = d.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DeliveryRetriedEvent);
  });

  it('refuses retry from REQUESTED and CONFIRMED', () => {
    const requested = requestedDispatch();
    expect(() => requested.requestRetry()).toThrow(RetryNotAllowedError);

    const confirmed = requestedDispatch();
    confirmed.confirmDelivered();
    confirmed.pullDomainEvents();
    expect(() => confirmed.requestRetry()).toThrow(RetryNotAllowedError);
  });

  it('rejects a malformed delivery address', () => {
    expect(() => DeliveryAddress.of('not-an-email')).toThrow(AddressMalformedError);
    expect(() => DeliveryAddress.of('')).toThrow(AddressMalformedError);
  });

  it('rejects a blank idempotency key', () => {
    expect(() => IdempotencyKey.of('')).toThrow();
    expect(() => IdempotencyKey.of('   ')).toThrow();
  });

  it('drains domain events on pull', () => {
    const d = NotificationDispatch.requestDelivery({ ...deliveryParts(), reason: 'welcome' });

    expect(d.pullDomainEvents()).toHaveLength(1);
    expect(d.pullDomainEvents()).toHaveLength(0);
  });
});
