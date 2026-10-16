import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class SignVoteContentCommand {
  constructor(
    public readonly walletId: UserWalletId,
    public readonly contentRef: SignedContentRef,
  ) {
    if (!walletId) throw new Error('walletId required');
    if (!contentRef) throw new Error('contentRef required');
  }
}
