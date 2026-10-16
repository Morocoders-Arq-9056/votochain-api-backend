export interface LedgerOutcome {
  confirmed: boolean;
  reason: string | null;
  retryable: boolean;
}

export const LEDGER_GATEWAY = Symbol('LEDGER_GATEWAY');

/**
 * Hands the signed order to the ledger and observes the outcome. Translates
 * only; meaning is decided by `DeliveryOrder.observeOutcome`.
 */
export interface LedgerGatewayService {
  submit(orderId: string): Promise<LedgerOutcome>;
}
