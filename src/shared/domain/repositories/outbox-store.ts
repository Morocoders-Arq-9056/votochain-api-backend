import type { DomainEvent } from '../model/domain-event.js';

export interface OutboxRecord {
  id: string;
  eventName: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * Persistence port for the transactional outbox. `stage()` MUST be called
 * inside the business transaction (it joins via `TransactionContext`), so a
 * committed unit of work always leaves its events durably staged — the crash
 * window between commit and bus emission is then recoverable by the relay.
 * No handler may depend on methods of the revived payload: recovery emits
 * plain JSON objects (`{...payload, eventName, occurredAt}`), so handlers
 * must only read plain-data properties.
 */
export interface OutboxStore {
  stage(events: DomainEvent[]): Promise<string[]>;
  markPublished(ids: string[]): Promise<void>;
  findUnpublished(limit: number): Promise<OutboxRecord[]>;
}

export const OUTBOX_STORE = Symbol('OUTBOX_STORE');
