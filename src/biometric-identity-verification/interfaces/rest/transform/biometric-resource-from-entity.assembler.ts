import type { BiometricProfile } from "../../../domain/model/aggregates/biometric-profile.aggregate.js";
import type { VerificationAttempt } from "../../../domain/model/aggregates/verification-attempt.aggregate.js";
import { AttemptHistoryResource } from "../resources/attempt-history.resource.js";
import { AttemptResource } from "../resources/attempt.resource.js";
import { ProfileResource } from "../resources/profile.resource.js";
import { VerifiedNowResource } from "../resources/verified-now.resource.js";

/** Renders response resources straight from re-read aggregates. */
export class BiometricResourceFromEntityAssembler {
  static toProfileResource(profile: BiometricProfile): ProfileResource {
    return new ProfileResource(profile.id.value, profile.personId.value, profile.standing);
  }

  static toAttemptResource(attempt: VerificationAttempt): AttemptResource {
    return new AttemptResource(attempt.id.value, attempt.personId.value, attempt.standing);
  }

  static toAttemptHistoryResource(attempts: VerificationAttempt[]): AttemptHistoryResource {
    return new AttemptHistoryResource(attempts.map((a) => this.toAttemptResource(a)));
  }

  static toVerifiedNowResource(answer: { verifiedNow: boolean; reason: string | null }): VerifiedNowResource {
    return new VerifiedNowResource(answer.verifiedNow, answer.reason);
  }
}
