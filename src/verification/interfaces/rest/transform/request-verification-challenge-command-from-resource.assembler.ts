import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { RequestVerificationChallengeCommand } from "../../../domain/model/commands/request-verification-challenge.command.js";
import { PurposeUnknownError } from "../../../domain/exceptions/purpose-unknown.error.js";
import { NoUsableChallengeError } from "../../../domain/exceptions/no-usable-challenge.error.js";
import { parsePurpose } from "../../../domain/model/valueobjects/purpose.value-object.js";
import { RequestChallengeResource } from "../resources/request-challenge.resource.js";

export class RequestVerificationChallengeCommandFromResourceAssembler {
  static toCommandFromResource(resource: RequestChallengeResource): RequestVerificationChallengeCommand {
    let personId: PersonId;
    try {
      personId = PersonId.of(resource.personId);
    } catch {
      throw new NoUsableChallengeError('unknown person');
    }
    try {
      return new RequestVerificationChallengeCommand(personId, parsePurpose(resource.purpose));
    } catch {
      throw new PurposeUnknownError();
    }
  }
}
