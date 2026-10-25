import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AggregateRoot } from '../../../../domain/model/aggregate-root.js';
import type { IUnitOfWork } from '../../../../domain/repositories/unit-of-work.js';
import type { OutboxStore } from '../../../../domain/repositories/outbox-store.js';
import { OUTBOX_STORE } from '../../../../domain/repositories/outbox-store.js';
import { TransactionContext } from './transaction-context.js';
import { DomainEventScope, installDomainEventSink } from '../outbox/domain-event-scope.js';

@Injectable()
export class TypeOrmUnitOfWork implements IUnitOfWork {
  private readonly logger = new Logger(TypeOrmUnitOfWork.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    private readonly events: EventEmitter2,
  ) {
    installDomainEventSink();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let stagedIds: string[] = [];
    try {
      const { result, events } = await TransactionContext.run(runner.manager, () =>
        DomainEventScope.runCollecting(fn),
      );
      if (events.length > 0) {
        stagedIds = await TransactionContext.run(runner.manager, () =>
          this.outbox.stage(events.map(({ event }) => event)),
        );
      }
      await runner.commitTransaction();
      if (events.length > 0) {
        // Drain the same facts from the aggregates so the services' own
        // post-commit `publish()` calls (kept for passthrough fakes) no-op:
        // this UoW already owns emission from here on.
        const seen = new Set<AggregateRoot>();
        for (const { aggregate } of events) {
          if (!seen.has(aggregate)) {
            seen.add(aggregate);
            aggregate.pullDomainEvents();
          }
        }
        for (const { event } of events) this.events.emit(event.eventName, event);
        try {
          await this.outbox.markPublished(stagedIds);
        } catch (e) {
          // Crash-equivalent: the relay redelivers these rows (at-least-once).
          this.logger.warn(`outbox mark-published deferred to relay: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async runWithAfterCommit<T>(fn: () => Promise<T>, afterCommit: (result: T) => Promise<void> | void): Promise<T> {
    const result = await this.run(fn);
    await afterCommit(result);
    return result;
  }
}
