import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";

/**
 * Event emitted when a challenge expires for a specific person, with a defined purpose.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export class ChallengeExpiredEvent implements DomainEvent {
  static readonly eventName = 'ChallengeExpired';
  readonly eventName = ChallengeExpiredEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates a new instance of ChallengeExpiredEvent.
   * @param challengeId The ID of the expired challenge.
   * @param personId The ID of the person for whom the challenge expired.
   * @param purpose The purpose of the expired challenge.
   */
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
  ) {}
}
