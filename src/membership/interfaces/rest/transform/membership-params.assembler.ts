import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { parseCommunityRole } from "../../../domain/model/valueobjects/community-role.value-object.js";
import type { CommunityRole } from "../../../domain/model/valueobjects/community-role.value-object.js";
import { MembershipId } from "../../../domain/model/valueobjects/membership-id.value-object.js";
import { MembershipStatus, parseMembershipStatus } from "../../../domain/model/valueobjects/membership-status.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { Unit } from "../../../domain/model/valueobjects/unit.value-object.js";
import { IllegalMembershipTransitionError } from "../../../domain/exceptions/illegal-membership-transition.error.js";
import { MembershipNotFoundError } from "../../../domain/exceptions/membership-not-found.error.js";

/**
 * Parses membership boundary strings into domain value objects.
 * Corrupt input raises domain rejections so the exception filter maps them.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipParamsAssembler {
  static toMembershipId(id: string): MembershipId {
    try {
      return MembershipId.of(id);
    } catch {
      throw new MembershipNotFoundError('membership not found');
    }
  }

  static toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new MembershipNotFoundError('membership not found');
    }
  }

  static toCommunityId(communityId: string): CommunityId {
    try {
      return CommunityId.of(communityId);
    } catch {
      throw new MembershipNotFoundError('membership not found');
    }
  }

  static toUnit(unitCode: string, communityName?: string): Unit {
    try {
      return Unit.of(unitCode, communityName);
    } catch {
      throw new IllegalMembershipTransitionError('unit required');
    }
  }

  static toRole(role: string): CommunityRole {
    try {
      return parseCommunityRole(role);
    } catch {
      throw new IllegalMembershipTransitionError('invalid role');
    }
  }

  static toReason(reason: string | undefined): string {
    if (!reason?.trim()) throw new IllegalMembershipTransitionError('reason required');
    return reason;
  }

  static toStatus(status: string): MembershipStatus {
    try {
      return parseMembershipStatus(status);
    } catch {
      throw new IllegalMembershipTransitionError('unknown status');
    }
  }
}
