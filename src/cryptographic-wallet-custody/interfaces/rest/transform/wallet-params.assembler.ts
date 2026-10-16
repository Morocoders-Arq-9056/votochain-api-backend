import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { IllegalWalletStateError } from "../../../domain/exceptions/illegal-wallet-state.error.js";
import { CapabilityNotFoundError } from "../../../domain/exceptions/capability-not-found.error.js";
import { DerivationPosition } from "../../../domain/model/valueobjects/derivation-position.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { UserWalletId } from "../../../domain/model/valueobjects/user-wallet-id.value-object.js";

/**
 * Parses wallet boundary strings into domain value objects. Corrupt input
 * raises domain rejections so the exception filter maps them.
 */
export class WalletParamsAssembler {
  static toUserWalletId(id: string): UserWalletId {
    try {
      return UserWalletId.of(id);
    } catch {
      throw new CapabilityNotFoundError('wallet not found');
    }
  }

  static toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new CapabilityNotFoundError('wallet not found');
    }
  }

  static toDerivationPosition(position: number): DerivationPosition {
    try {
      return DerivationPosition.of(position);
    } catch {
      throw new IllegalWalletStateError('invalid position');
    }
  }

  static toSignedContentRef(contentRef: string): SignedContentRef {
    try {
      return SignedContentRef.of(contentRef);
    } catch {
      throw new IllegalWalletStateError('content required');
    }
  }

  static toReason(reason: string | undefined): string {
    if (!reason?.trim()) throw new IllegalWalletStateError('reason required');
    return reason;
  }
}
