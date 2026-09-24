import { VerificationChallenge } from '../../../domain/model/aggregates/verification-challenge.aggregate.js';
import { ChallengeResource } from '../resources/challenge.resource.js';

export class ChallengeResourceFromEntityAssembler {
  static toResourceFromEntity(challenge: VerificationChallenge): ChallengeResource {
    return new ChallengeResource(
      challenge.id.value,
      challenge.personId.value,
      challenge.purpose,
      challenge.standing,
      challenge.attempts.count,
      challenge.attempts.max,
      challenge.attempts.remaining(),
      challenge.window.requestedAt,
      challenge.window.expiresAt,
      challenge.invalidationReason,
    );
  }
}
