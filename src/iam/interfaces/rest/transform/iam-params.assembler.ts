import { UserId } from "../../../domain/model/valueobjects/user-id.value-object.js";
import { OutsideProverRef } from "../../../domain/model/valueobjects/outside-prover-ref.value-object.js";
import { ProofKind, parseProofKind } from "../../../domain/model/valueobjects/proof-kind.value-object.js";
import { SystemRole, parseSystemRole } from "../../../domain/model/valueobjects/system-role.value-object.js";
import { IllegalUserStateError } from "../../../domain/exceptions/illegal-user-state.error.js";
import { ProofNotHeldError } from "../../../domain/exceptions/proof-not-held.error.js";
import { UserNotFoundError } from "../../../domain/exceptions/user-not-found.error.js";

/**
 * Parses IAM boundary strings into domain value objects.
 * Corrupt input raises domain rejections so the exception filter maps them.
 * Path params skip class-validator, so the boundary translates here.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-29
 */
export class IamParamsAssembler {
  static toUserId(id: string): UserId {
    try {
      return UserId.of(id);
    } catch {
      throw new UserNotFoundError('user not found');
    }
  }

  static toSystemRole(role: string): SystemRole {
    try {
      return parseSystemRole(role);
    } catch {
      throw new IllegalUserStateError('unknown role');
    }
  }

  static toProofKind(kind: string): ProofKind {
    try {
      return parseProofKind(kind);
    } catch {
      throw new IllegalUserStateError('unknown proof kind');
    }
  }

  /**
   * Validates a provider path param, allowing only supported provers.
   * @param provider Raw prover name path string.
   * @returns The validated provider name.
   */
  static toProvider(provider: string): string {
    try {
      return OutsideProverRef.of(provider, provider).provider;
    } catch {
      throw new ProofNotHeldError('proof not held');
    }
  }

  static toReason(reason: string | undefined): string {
    if (!reason?.trim()) throw new IllegalUserStateError('reason required');
    return reason;
  }
}
