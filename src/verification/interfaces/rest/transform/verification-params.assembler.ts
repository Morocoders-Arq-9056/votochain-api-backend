import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../../../domain/model/valueobjects/challenge-id.value-object.js";
import { Purpose, parsePurpose } from "../../../domain/model/valueobjects/purpose.value-object.js";
import { NoUsableChallengeError } from "../../../domain/exceptions/no-usable-challenge.error.js";
import { PurposeUnknownError } from "../../../domain/exceptions/purpose-unknown.error.js";

/**
 * Coercion boundary for URL path and query string values. Untrusted strings
 * become typed VOs here — or the matching domain rejection, rendered by
 * {@link VerificationExceptionFilter}. Application and domain only ever
 * receive VOs, never raw strings.
 */
export class VerificationParamsAssembler {
  static toChallengeId(value: string): ChallengeId {
    try {
      return ChallengeId.of(value);
    } catch {
      throw new NoUsableChallengeError('no usable challenge');
    }
  }

  static toPersonId(value: string): PersonId {
    try {
      return PersonId.of(value);
    } catch {
      throw new NoUsableChallengeError('unknown person');
    }
  }

  static toPurpose(value: string): Purpose {
    try {
      return parsePurpose(value);
    } catch {
      throw new PurposeUnknownError();
    }
  }
}
