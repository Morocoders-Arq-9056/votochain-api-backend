import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";

/**
 * Event emitted when a challenge is confirmed for a specific person, with a defined purpose.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export class ChallengeConfirmedEvent implements DomainEvent {
  static readonly eventName = 'ChallengeConfirmed';
  readonly eventName = ChallengeConfirmedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates a new instance of ChallengeConfirmedEvent.
   * @param challengeId The ID of the confirmed challenge.
   * @param personId The ID of the person for whom the challenge is confirmed.
   * @param purpose The purpose of the confirmed challenge.
   */
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
  ) {}
}
