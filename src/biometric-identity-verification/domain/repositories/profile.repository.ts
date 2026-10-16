import { BiometricProfile } from "../model/aggregates/biometric-profile.aggregate.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";

/** Persistence port for the BiometricProfile aggregate root. */
export interface ProfileRepository {
  findById(id: import("../model/valueobjects/biometric-profile-id.value-object.js").BiometricProfileId): Promise<BiometricProfile | null>;
  findLiveByPerson(personId: PersonId): Promise<BiometricProfile | null>;
  save(profile: BiometricProfile): Promise<void>;
}
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
