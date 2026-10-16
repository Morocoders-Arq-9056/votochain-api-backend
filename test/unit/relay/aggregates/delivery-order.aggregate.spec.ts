import { DeliveryOrder } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/aggregates/delivery-order.aggregate.js';
import { DeliveryOrderId } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/valueobjects/delivery-order-id.value-object.js';
import { DeliveryStanding } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/valueobjects/delivery-standing.value-object.js';
import { FailureReason } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/valueobjects/failure-reason.value-object.js';
import { PayerRef } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/valueobjects/payer-ref.value-object.js';
import { SendingOrderPosition } from '../../../../src/blockchain-relay-transaction-delivery/domain/model/valueobjects/sending-order-position.value-object.js';
import { IllegalDeliveryStateError } from '../../../../src/blockchain-relay-transaction-delivery/domain/exceptions/illegal-delivery-state.error.js';
import { UnsignedContentRefusedError } from '../../../../src/blockchain-relay-transaction-delivery/domain/exceptions/unsigned-content-refused.error.js';
import type { FeePolicy, RetryPolicy } from '../../../../src/blockchain-relay-transaction-delivery/domain/services/delivery-policies.service.js';
import { SignedContentRef } from '../../../../src/shared/domain/model/valueobjects/signed-content-ref.value-object.js';

const CONTENT = 'signed:prop-1:0xvoter:sig';
const PAYER = 'relayer:polygon-amoy';

function accept(): DeliveryOrder {
  return DeliveryOrder.accept(
    DeliveryOrderId.generate(),
    SignedContentRef.of(CONTENT),
    PayerRef.of(PAYER),
    SendingOrderPosition.of(0),
    'proof-sig',
  );
}

const allowRetry: RetryPolicy = { shouldRetry: () => true };
const noRetry: RetryPolicy = { shouldRetry: () => false };
const afford: FeePolicy = { canAfford: () => true };
const broke: FeePolicy = { canAfford: () => false };

describe('DeliveryOrder aggregate', () => {
  it('refuses unsigned content at intake', () => {
    expect(() => DeliveryOrder.accept(
      DeliveryOrderId.generate(),
      SignedContentRef.of(CONTENT),
      PayerRef.of(PAYER),
      SendingOrderPosition.of(0),
      '  ',
    )).toThrow(UnsignedContentRefusedError);
  });

  it('flows ACCEPTED → ORDERED → SENT → CONFIRMED', () => {
    const o = accept();
    expect(o.standing).toBe(DeliveryStanding.ACCEPTED);
    o.order();
    o.recordSending();
    o.observeOutcome(true, null, false, allowRetry, afford);
    expect(o.standing).toBe(DeliveryStanding.CONFIRMED);
    expect(o.answerDeliveryStanding()).toEqual({ standing: 'CONFIRMED', reason: null });
  });

  it('fails then retries inside the same order (never a 2nd order)', () => {
    const o = accept();
    o.order();
    o.recordSending();
    o.observeOutcome(false, FailureReason.of('LEDGER_REJECTED'), true, allowRetry, afford);
    expect(o.standing).toBe(DeliveryStanding.RETRIED);
    expect(o.attempts).toHaveLength(2);
    o.order();
    o.recordSending();
    o.observeOutcome(true, null, false, allowRetry, afford);
    expect(o.standing).toBe(DeliveryStanding.CONFIRMED);
    expect(o.attempts).toHaveLength(3);
  });

  it('abandons on cost exhaustion, non-retryable reason and retry-limit', () => {
    const a = accept();
    a.order(); a.recordSending();
    a.observeOutcome(false, FailureReason.of('LEDGER_REJECTED'), true, allowRetry, broke);
    expect(a.standing).toBe(DeliveryStanding.ABANDONED);
    expect(a.answerDeliveryStanding().reason).toBe('LEDGER_REJECTED');

    const b = accept();
    b.order(); b.recordSending();
    b.observeOutcome(false, FailureReason.of('LEDGER_REJECTED'), false, allowRetry, afford);
    expect(b.standing).toBe(DeliveryStanding.ABANDONED);

    const c = accept();
    c.order(); c.recordSending();
    c.observeOutcome(false, FailureReason.of('LEDGER_REJECTED'), true, noRetry, afford);
    expect(c.standing).toBe(DeliveryStanding.ABANDONED);
    expect(c.answerDeliveryStanding().reason).toBe('LEDGER_REJECTED');
  });

  it('refuses any mutation after CONFIRMED (terminal)', () => {
    const o = accept();
    o.order(); o.recordSending();
    o.observeOutcome(true, null, false, allowRetry, afford);
    expect(() => o.retry(allowRetry)).toThrow(IllegalDeliveryStateError);
    expect(() => o.recordSending()).toThrow(IllegalDeliveryStateError);
  });

  it('confirms only from SENT', () => {
    const o = accept();
    expect(() => o.recordConfirmation()).toThrow(IllegalDeliveryStateError);
  });
});
