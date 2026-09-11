import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.js";
import { SystemRole } from "../valueobjects/system-role.js";
import { UserId } from "../valueobjects/user-id.js";

export class SystemRoleGrantedEvent implements DomainEvent {
  static readonly eventName = 'SystemRoleGranted';
  readonly eventName = SystemRoleGrantedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly role: SystemRole,
  ) {}
}
