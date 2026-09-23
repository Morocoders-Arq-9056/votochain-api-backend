import { Injectable } from "@nestjs/common";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { VerificationChallenge } from "../../../../domain/model/aggregates/verification-challenge.aggregate.js";
import { AttemptCount } from "../../../../domain/model/valueobjects/attempt-count.value-object.js";
import { ChallengeId } from "../../../../domain/model/valueobjects/challenge-id.value-object.js";
import { parseChallengeStanding } from "../../../../domain/model/valueobjects/challenge-standing.value-object.js";
import { parseInvalidationReason } from "../../../../domain/model/valueobjects/invalidation-reason.value-object.js";
import { parsePurpose } from "../../../../domain/model/valueobjects/purpose.value-object.js";
import { ValidityWindow } from "../../../../domain/model/valueobjects/validity-window.value-object.js";
import { ChallengeOrmEntity } from "../entities/challenge.orm-entity.js";

/**
 * Translates between the `VerificationChallenge` domain aggregate and its
 * `ChallengeOrmEntity` persistence shape. Domain → ORM reads everything off
 * the aggregate; ORM → domain parses every string through explicit parsers
 * (never `as`), so a corrupt row throws where the corruption happened.
 * Secrets never appear: only the code hash crosses this boundary.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ChallengePersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: ChallengeOrmEntity): VerificationChallenge {
    return VerificationChallenge.rehydrate({
      id: ChallengeId.of(entity.id),
      personId: PersonId.of(entity.personId),
      purpose: parsePurpose(entity.purpose),
      standing: parseChallengeStanding(entity.standing),
      attempts: AttemptCount.of(entity.attempts, entity.maxAttempts),
      window: ValidityWindow.of(entity.requestedAt, entity.expiresAt),
      codeHash: entity.codeHash,
      reason: entity.reason ? parseInvalidationReason(entity.reason) : null,
    });
  }

  /**
   * Renders the persistence row straight from the aggregate being saved.
   * Nothing enters the row that did not come from the domain object.
   * @param challenge The aggregate to persist.
   */
  toOrmFromDomain(challenge: VerificationChallenge): ChallengeOrmEntity {
    const ormEntity = new ChallengeOrmEntity();
    ormEntity.id = challenge.id.value;
    ormEntity.personId = challenge.personId.value;
    ormEntity.purpose = challenge.purpose;
    ormEntity.standing = challenge.standing;
    ormEntity.attempts = challenge.attempts.count;
    ormEntity.maxAttempts = challenge.attempts.max;
    ormEntity.codeHash = challenge.codeHash;
    ormEntity.requestedAt = challenge.window.requestedAt;
    ormEntity.expiresAt = challenge.window.expiresAt;
    ormEntity.reason = challenge.invalidationReason;
    return ormEntity;
  }
}
