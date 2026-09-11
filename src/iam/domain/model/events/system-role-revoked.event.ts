import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.js";
import { SystemRole } from "../valueobjects/system-role.js";
import { UserId } from "../valueobjects/user-id.js";

export class SystemRoleRevokedEvent implements DomainEvent {
  static readonly eventName = 'SystemRoleRevoked';
  readonly eventName = SystemRoleRevokedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly role: SystemRole,
  ) {}
}
