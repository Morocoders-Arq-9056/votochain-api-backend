import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { PersonReference } from "../valueobjects/person-reference.value-object.js";

export class PersonDataScrubbedEvent implements DomainEvent {
  static readonly eventName = 'PersonDataScrubbed';
  readonly eventName = PersonDataScrubbedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly person: PersonReference,
    public readonly redactedKeys: string[],
  ) {}
}
