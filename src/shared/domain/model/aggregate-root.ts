import type { DomainEvent } from './domain-event.js';

export abstract class AggregateRoot {
  protected readonly _domainEvents: DomainEvent[] = [];

  protected registerEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
