import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { CommunityStanding, parseCommunityStanding } from "../../../domain/model/valueobjects/community-standing.value-object.js";
import { CommunityNotFoundError } from "../../../domain/exceptions/community-not-found.error.js";
import { IllegalCommunityTransitionError } from "../../../domain/exceptions/illegal-community-transition.error.js";
import { PersonUnknownError } from "../../../domain/exceptions/person-unknown.error.js";

/**
 * Parses community boundary strings into domain value objects.
 * Corrupt input raises domain rejections so the exception filter maps them.
 */
export class CommunityParamsAssembler {
  static toCommunityId(id: string): CommunityId {
    try {
      return CommunityId.of(id);
    } catch {
      throw new CommunityNotFoundError('community not found');
    }
  }

  static toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new PersonUnknownError('person unknown');
    }
  }

  static toStanding(standing: string): CommunityStanding {
    try {
      return parseCommunityStanding(standing);
    } catch {
      throw new IllegalCommunityTransitionError('unknown standing');
    }
  }
}
