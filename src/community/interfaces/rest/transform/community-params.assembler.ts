import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { CommunityNotFoundError } from "../../../domain/exceptions/community-not-found.error.js";
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
}
