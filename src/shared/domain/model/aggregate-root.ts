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

  /**
   * Reads the buffered events without draining them. Repositories use this
   * to persist scrutiny alongside the aggregate; the command service drains
   * (pull) the same events for the bus strictly after commit.
   */
  peekDomainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }
}
