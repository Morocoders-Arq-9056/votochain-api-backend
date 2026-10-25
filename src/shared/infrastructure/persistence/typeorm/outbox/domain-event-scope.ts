import { AsyncLocalStorage } from 'node:async_hooks';
import type { AggregateRoot } from '../../../../domain/model/aggregate-root.js';
import type { DomainEvent } from '../../../../domain/model/domain-event.js';
import { setDomainEventSink } from '../../../../domain/model/domain-event-sink.js';

export interface CollectedDomainEvent {
  aggregate: AggregateRoot;
  event: DomainEvent;
}

const storage = new AsyncLocalStorage<CollectedDomainEvent[]>();

/**
 * Transaction-scoped domain-event collector (outbox seam, infrastructure
 * side). `TypeOrmUnitOfWork` runs each transaction inside `runCollecting`;
 * every `AggregateRoot.registerEvent` during the unit of work is captured
 * here in registration order, in addition to the aggregate's local buffer.
 *
 * Registration into the domain SPI happens once per process via
 * `installDomainEventSink()` (called from the `TypeOrmUnitOfWork`
 * constructor, so the sink exists wherever the real UoW is provided).
 */
export const DomainEventScope = {
  async runCollecting<T>(fn: () => Promise<T>): Promise<{ result: T; events: CollectedDomainEvent[] }> {
    const events: CollectedDomainEvent[] = [];
    const result = await storage.run(events, fn);
    return { result, events };
  },

  collect(aggregate: AggregateRoot, event: DomainEvent): void {
    storage.getStore()?.push({ aggregate, event });
  },
};

export function installDomainEventSink(): void {
  setDomainEventSink({
    collect: (aggregate, event) => DomainEventScope.collect(aggregate, event),
  });
}
