import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class KeyForgottenEvent implements DomainEvent {
  static readonly eventName = 'KeyForgotten';
  readonly eventName = KeyForgottenEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly walletId: UserWalletId,
    public readonly contentRef: SignedContentRef,
  ) {}
}
