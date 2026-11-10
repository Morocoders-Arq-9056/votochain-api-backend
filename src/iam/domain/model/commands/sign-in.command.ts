import { ProofKind } from "../valueobjects/proof-kind.value-object.js";

/**
 * Classic-login sign-in carrying what the caller knows (address + secret).
 * The server resolves the address into the technical identity; callers
 * never present a user id they cannot know. OUTSIDE keeps the linked
 * outside proof path (no secret); LOCAL (default) requires one.
 */
export class SignInCommand {
  constructor(
    public readonly email: string,
    public readonly plainSecret: string | null,
    public readonly proofKind: ProofKind = ProofKind.LOCAL,
  ) {
    if (!email?.trim()) throw new Error('email required');
    if (!proofKind) throw new Error('proofKind required');
  }
}
