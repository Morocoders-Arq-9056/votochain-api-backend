import { Injectable } from "@nestjs/common";
import { VerificationAttempt } from "../../../../domain/model/aggregates/verification-attempt.aggregate.js";
import { parseAttemptStanding } from "../../../../domain/model/valueobjects/attempt-standing.value-object.js";
import { BiometricProfileId } from "../../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { parseFailureReason } from "../../../../domain/model/valueobjects/failure-reason.value-object.js";
import { FreshnessWindow } from "../../../../domain/model/valueobjects/freshness-window.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../../../../domain/model/valueobjects/verification-attempt-id.value-object.js";
import { AttemptOrmEntity } from "../entities/attempt.orm-entity.js";

/** Translates between the VerificationAttempt aggregate and its ORM shape. */
@Injectable()
export class AttemptPersistenceAssembler {
  toDomainFromOrm(entity: AttemptOrmEntity): VerificationAttempt {
    return VerificationAttempt.rehydrate({
      id: VerificationAttemptId.of(entity.id),
      personId: PersonId.of(entity.personId),
      profileId: BiometricProfileId.of(entity.profileId),
      standing: parseAttemptStanding(entity.standing),
      freshness: FreshnessWindow.rehydrate(entity.freshnessStart, entity.freshnessMinutes),
      failure: entity.failureReason ? parseFailureReason(entity.failureReason) : null,
    });
  }

  toOrmFromDomain(attempt: VerificationAttempt): AttemptOrmEntity {
    const orm = new AttemptOrmEntity();
    orm.id = attempt.id.value;
    orm.personId = attempt.personId.value;
    orm.profileId = attempt.profileId.value;
    orm.standing = attempt.standing;
    orm.freshnessStart = attempt.freshness.start ?? new Date();
    orm.freshnessMinutes = attempt.freshness.durationMinutes;
    orm.failureReason = attempt.failure;
    return orm;
  }
}
