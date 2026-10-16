import { Injectable } from "@nestjs/common";
import type { DomainEvent } from "../../../../../shared/domain/model/domain-event.js";
import { SignedContentRef } from "../../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { UserWallet } from "../../../../domain/model/aggregates/user-wallet.aggregate.js";
import { KeyForgottenEvent } from "../../../../domain/model/events/key-forgotten.event.js";
import { KeyReconstructedEvent } from "../../../../domain/model/events/key-reconstructed.event.js";
import { WalletProvisionedEvent } from "../../../../domain/model/events/wallet-provisioned.event.js";
import { WalletRetiredEvent } from "../../../../domain/model/events/wallet-retired.event.js";
import { WalletRotatedEvent } from "../../../../domain/model/events/wallet-rotated.event.js";
import { WalletSuspendedEvent } from "../../../../domain/model/events/wallet-suspended.event.js";
import { DerivationPosition } from "../../../../domain/model/valueobjects/derivation-position.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { UserWalletId } from "../../../../domain/model/valueobjects/user-wallet-id.value-object.js";
import { parseWalletStanding } from "../../../../domain/model/valueobjects/wallet-standing.value-object.js";
import { WalletOrmEntity } from "../entities/wallet.orm-entity.js";

/**
 * Translates between the UserWallet aggregate (+ its scrutiny events) and
 * the ORM shapes. Closed sets parse explicitly (never `as`); scrutiny
 * payloads are plain JSON facts, reconstructed by event name.
 */
@Injectable()
export class WalletPersistenceAssembler {
  toDomainFromOrm(entity: WalletOrmEntity): UserWallet {
    return UserWallet.rehydrate(
      UserWalletId.of(entity.id),
      PersonId.of(entity.personId),
      DerivationPosition.of(entity.derivationPosition),
      parseWalletStanding(entity.standing),
      entity.openFor ? SignedContentRef.of(entity.openFor) : null,
    );
  }

  toOrmFromDomain(wallet: UserWallet): WalletOrmEntity {
    const orm = new WalletOrmEntity();
    orm.id = wallet.id.value;
    orm.personId = wallet.personId.value;
    orm.derivationPosition = wallet.position.value;
    orm.standing = wallet.standing;
    orm.openFor = wallet.openFor?.value ?? null;
    return orm;
  }

  /**
   * Renders a scrutiny payload from a domain event. Plain JSON facts only —
   * no images, portraits, scores or secrets ever travel here.
   * @param event Domain fact to persist.
   */
  toPayload(event: DomainEvent): Record<string, unknown> {
    return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
  }

  /**
   * Rebuilds a scrutiny fact from its stored row, by wire event name.
   * @param eventName Wire name (`eventName` column).
   * @param payload Stored payload.
   * @param occurredAt Stored occurrence instant.
   */
  toDomainEvent(eventName: string, payload: Record<string, unknown>, occurredAt: Date): DomainEvent {
    let event: DomainEvent;
    switch (eventName) {
      case WalletProvisionedEvent.eventName:
        event = new WalletProvisionedEvent(
          UserWalletId.of(vo(payload['walletId'])),
          PersonId.of(vo(payload['personId'])),
          DerivationPosition.of(num(payload['position'])),
        );
        break;
      case KeyReconstructedEvent.eventName:
        event = new KeyReconstructedEvent(
          UserWalletId.of(vo(payload['walletId'])),
          SignedContentRef.of(vo(payload['contentRef'])),
        );
        break;
      case KeyForgottenEvent.eventName:
        event = new KeyForgottenEvent(
          UserWalletId.of(vo(payload['walletId'])),
          SignedContentRef.of(vo(payload['contentRef'])),
        );
        break;
      case WalletRotatedEvent.eventName:
        event = new WalletRotatedEvent(
          UserWalletId.of(vo(payload['walletId'])),
          DerivationPosition.of(num(payload['fromPosition'])),
          DerivationPosition.of(num(payload['toPosition'])),
        );
        break;
      case WalletSuspendedEvent.eventName:
        event = new WalletSuspendedEvent(
          UserWalletId.of(vo(payload['walletId'])),
          String(payload['reason'] ?? ''),
        );
        break;
      case WalletRetiredEvent.eventName:
        event = new WalletRetiredEvent(
          UserWalletId.of(vo(payload['walletId'])),
          PersonId.of(vo(payload['personId'])),
        );
        break;
      default:
        throw new Error(`unknown wallet event: ${eventName}`);
    }
    (event as { occurredAt: Date }).occurredAt = occurredAt;
    return event;
  }
}

/** Unwraps a VO-ish JSON value to its raw string. */
function vo(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: unknown }).value);
  throw new Error('invalid scrutiny payload');
}

/** Unwraps a VO-ish JSON value to its raw number. */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) {
    const raw = (v as { value: unknown }).value;
    if (typeof raw === 'number') return raw;
  }
  throw new Error('invalid scrutiny payload');
}
