import { ProofKind } from "../valueobjects/proof-kind.js";
import { UserId } from "../valueobjects/user-id.js";

export class SignInCommand {
  constructor(
    public readonly userId: UserId,
    public readonly proofKind: ProofKind,
  ) {
    if (!userId) throw new Error('userId required');
    if (!proofKind) throw new Error('proofKind required');
  }
}
