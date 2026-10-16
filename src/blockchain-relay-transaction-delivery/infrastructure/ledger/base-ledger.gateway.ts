import type { LedgerGatewayService, LedgerOutcome } from "../../application/internal/outboundservices/ledger/ledger-gateway.service.js";

/**
 * Template Method for ledger submission: build â†’ broadcast â†’ observe.
 * Per-BC gateways inherit and override only the hooks; the flow never changes.
 */
export abstract class BaseLedgerGateway implements LedgerGatewayService {
  async submit(orderId: string): Promise<LedgerOutcome> {
    const tx = await this.buildTx(orderId);
    const hash = await this.broadcast(tx);
    return this.observe(hash);
  }

  protected abstract buildTx(orderId: string): Promise<unknown>;
  protected abstract broadcast(tx: unknown): Promise<string>;
  protected abstract observe(hash: string): Promise<LedgerOutcome>;
}
