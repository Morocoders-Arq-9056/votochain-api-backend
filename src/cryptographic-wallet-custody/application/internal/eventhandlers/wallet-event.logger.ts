import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { KeyForgottenEvent } from "../../../domain/model/events/key-forgotten.event.js";
import { KeyReconstructedEvent } from "../../../domain/model/events/key-reconstructed.event.js";
import { WalletProvisionedEvent } from "../../../domain/model/events/wallet-provisioned.event.js";
import { WalletRetiredEvent } from "../../../domain/model/events/wallet-retired.event.js";
import { WalletRotatedEvent } from "../../../domain/model/events/wallet-rotated.event.js";
import { WalletSuspendedEvent } from "../../../domain/model/events/wallet-suspended.event.js";

/**
 * Observability only. Exempt from the `<Stem>EventHandler` rename: a generic
 * logger, never subscribed from another module.
 */
@Injectable()
export class WalletEventLogger {
  private readonly logger = new Logger(WalletEventLogger.name);

  @OnEvent(WalletProvisionedEvent.eventName, { async: true })
  onProvisioned(event: WalletProvisionedEvent): void {
    this.logger.log(`wallet provisioned ${event.walletId.value} at ${event.position.value}`);
  }

  @OnEvent(KeyReconstructedEvent.eventName, { async: true })
  onReconstructed(event: KeyReconstructedEvent): void {
    this.logger.log(`key reconstructed for ${event.walletId.value}`);
  }

  @OnEvent(KeyForgottenEvent.eventName, { async: true })
  onForgotten(event: KeyForgottenEvent): void {
    this.logger.log(`key forgotten for ${event.walletId.value}`);
  }

  @OnEvent(WalletRotatedEvent.eventName, { async: true })
  onRotated(event: WalletRotatedEvent): void {
    this.logger.log(`wallet rotated ${event.walletId.value}: ${event.fromPosition.value}→${event.toPosition.value}`);
  }

  @OnEvent(WalletSuspendedEvent.eventName, { async: true })
  onSuspended(event: WalletSuspendedEvent): void {
    this.logger.warn(`wallet suspended ${event.walletId.value}: ${event.reason}`);
  }

  @OnEvent(WalletRetiredEvent.eventName, { async: true })
  onRetired(event: WalletRetiredEvent): void {
    this.logger.warn(`wallet retired ${event.walletId.value}`);
  }
}
