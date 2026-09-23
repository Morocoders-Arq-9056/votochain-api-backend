import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { InvalidationReason } from "../valueobjects/invalidation-reason.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";

/**
 * Event emitted when a challenge is invalidated for a specific person, with a defined purpose and reason for invalidation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export class ChallengeInvalidatedEvent implements DomainEvent {
  static readonly eventName = 'ChallengeInvalidated';
  readonly eventName = ChallengeInvalidatedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates a new instance of ChallengeInvalidatedEvent.
   * @param challengeId the challenge identifier.
   * @param personId the person identifier.
   * @param purpose the purpose of the invalidated challenge.
   * @param reason the reason for the invalidation.
   */
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
    public readonly reason: InvalidationReason,
  ) {}
}
