import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";

export class RevokeBiometricProfileCommand {
  constructor(public readonly profileId: BiometricProfileId) {
    if (!profileId) throw new Error('profileId required');
  }
}
