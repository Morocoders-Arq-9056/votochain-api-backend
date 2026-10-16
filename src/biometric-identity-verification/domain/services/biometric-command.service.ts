import { BiometricProfileId } from "../model/valueobjects/biometric-profile-id.value-object.js";
import { EnrollBiometricCommand } from "../model/commands/enroll-biometric.command.js";
import { StartLivenessChallengeCommand } from "../model/commands/start-liveness-challenge.command.js";
import { CompleteLivenessCommand } from "../model/commands/complete-liveness.command.js";
import { RequestComparisonCommand } from "../model/commands/request-comparison.command.js";
import { RecordVerdictCommand } from "../model/commands/record-verdict.command.js";
import { RevokeBiometricProfileCommand } from "../model/commands/revoke-biometric-profile.command.js";
import { VerificationAttemptId } from "../model/valueobjects/verification-attempt-id.value-object.js";

/**
 * Domain port for biometric writes. One method per command,
 * `methodName = lowerCamel(ClassName without Command)`, receiving the object.
 */
export interface BiometricCommandService {
  enrollBiometric(command: EnrollBiometricCommand): Promise<BiometricProfileId>;
  startLivenessChallenge(command: StartLivenessChallengeCommand): Promise<VerificationAttemptId>;
  completeLiveness(command: CompleteLivenessCommand): Promise<void>;
  requestComparison(command: RequestComparisonCommand): Promise<void>;
  recordVerdict(command: RecordVerdictCommand): Promise<void>;
  revokeBiometricProfile(command: RevokeBiometricProfileCommand): Promise<void>;
}
export const BIOMETRIC_COMMAND_SERVICE = Symbol('BIOMETRIC_COMMAND_SERVICE');
