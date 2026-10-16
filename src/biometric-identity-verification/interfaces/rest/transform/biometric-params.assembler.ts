import { BiometricProfileId } from "../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../../../domain/model/valueobjects/verification-attempt-id.value-object.js";
import { ReferenceRequiredError } from "../../../domain/exceptions/reference-required.error.js";

/**
 * Parses biometric boundary strings into domain value objects. Corrupt
 * input raises domain rejections so the exception filter maps them (404).
 */
export class BiometricParamsAssembler {
  static toBiometricProfileId(id: string): BiometricProfileId {
    try {
      return BiometricProfileId.of(id);
    } catch {
      throw new ReferenceRequiredError('profile not found');
    }
  }

  static toVerificationAttemptId(id: string): VerificationAttemptId {
    try {
      return VerificationAttemptId.of(id);
    } catch {
      throw new ReferenceRequiredError('attempt not found');
    }
  }

  static toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new ReferenceRequiredError('person required');
    }
  }
}
