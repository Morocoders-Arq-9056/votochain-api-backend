import type { AggregateRoot } from './aggregate-root.js';
import type { DomainEvent } from './domain-event.js';

/**
 * Domain-side SPI for transaction-scoped event capture (outbox seam).
 *
 * The domain never imports infrastructure: this file only declares the port.
 * Infrastructure (`DomainEventScope`, backed by `AsyncLocalStorage`) registers
 * the active collector; `AggregateRoot.registerEvent` notifies it alongside
 * the per-aggregate buffer. When no collector is active (unit tests with a
 * passthrough `IUnitOfWork`), registration is a no-op and the local buffer
 * keeps the previous behavior.
 */
export interface DomainEventSink {
  collect(aggregate: AggregateRoot, event: DomainEvent): void;
}

let activeSink: DomainEventSink | undefined;

export function setDomainEventSink(sink: DomainEventSink | undefined): void {
  activeSink = sink;
}

export function getDomainEventSink(): DomainEventSink | undefined {
  return activeSink;
}
