import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";

export class GetBiometricProfileByIdQuery {
  constructor(public readonly profileId: BiometricProfileId) {}
}
