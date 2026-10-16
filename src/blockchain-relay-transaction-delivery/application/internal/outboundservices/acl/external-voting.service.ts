import { Injectable } from "@nestjs/common";

/**
 * Notifies Voting of delivery outcomes (R5, Customer/Supplier + OHS).
 * Cycle-free: Relay never imports Voting — the default adapter logs and the
 * Voting-side `ExternalRelayService` drives outcomes through the Relay
 * facade (one-directional Voting → Relay). A future split deploys this as an
 * HTTP/gRPC client without changing the in-module handlers.
 */
@Injectable()
export class ExternalVotingService {
  async notifyConfirmed(_orderId: string): Promise<void> { void _orderId; }
  async notifyFailed(_orderId: string, _reason: string): Promise<void> { void _orderId; void _reason; }
  async notifyAbandoned(_orderId: string, _reason: string): Promise<void> { void _orderId; void _reason; }
}
