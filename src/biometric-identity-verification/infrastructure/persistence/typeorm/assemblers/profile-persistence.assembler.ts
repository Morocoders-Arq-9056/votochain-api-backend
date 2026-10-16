import { Injectable } from "@nestjs/common";
import { BiometricProfile } from "../../../../domain/model/aggregates/biometric-profile.aggregate.js";
import { BiometricProfileId } from "../../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { parseProfileStanding } from "../../../../domain/model/valueobjects/profile-standing.value-object.js";
import { ProfileOrmEntity } from "../entities/profile.orm-entity.js";

/** Translates between the BiometricProfile aggregate and its ORM shape. */
@Injectable()
export class ProfilePersistenceAssembler {
  toDomainFromOrm(entity: ProfileOrmEntity): BiometricProfile {
    return BiometricProfile.rehydrate({
      id: BiometricProfileId.of(entity.id),
      personId: PersonId.of(entity.personId),
      standing: parseProfileStanding(entity.standing),
    });
  }

  toOrmFromDomain(profile: BiometricProfile): ProfileOrmEntity {
    const orm = new ProfileOrmEntity();
    orm.id = profile.id.value;
    orm.personId = profile.personId.value;
    orm.standing = profile.standing;
    return orm;
  }
}
