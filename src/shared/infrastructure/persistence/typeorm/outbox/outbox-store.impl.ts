import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { DomainEvent } from '../../../../domain/model/domain-event.js';
import type { OutboxRecord, OutboxStore } from '../../../../domain/repositories/outbox-store.js';
import { TransactionContext } from '../repositories/transaction-context.js';
import { OutboxRecordOrmEntity } from '../entities/outbox-record.orm-entity.js';

/**
 * TypeORM implementation of the {@link OutboxStore} port. Joins the running
 * unit of work via `TransactionContext` so staged rows commit atomically with
 * the business change; outside a transaction it uses its own repository.
 * Payloads are plain JSON snapshots (VOs serialize to `{ value }`), revived
 * by the relay as `{ ...payload, eventName, occurredAt }`.
 */
@Injectable()
export class OutboxStoreImpl implements OutboxStore {
  constructor(
    @InjectRepository(OutboxRecordOrmEntity) private readonly orm: Repository<OutboxRecordOrmEntity>,
  ) {}

  private get repository(): Repository<OutboxRecordOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(OutboxRecordOrmEntity) : this.orm;
  }

  async stage(events: DomainEvent[]): Promise<string[]> {
    if (events.length === 0) return [];
    const rows = events.map((event) => {
      const orm = new OutboxRecordOrmEntity();
      orm.id = `obx-${randomUUID()}`;
      orm.eventName = event.eventName;
      orm.payload = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
      orm.published = false;
      orm.occurredAt = event.occurredAt;
      return orm;
    });
    await this.repository.save(rows);
    return rows.map((row) => row.id);
  }

  async markPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repository
      .createQueryBuilder()
      .update(OutboxRecordOrmEntity)
      .set({ published: true })
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  async findUnpublished(limit: number): Promise<OutboxRecord[]> {
    const found = await this.repository.find({
      where: { published: false },
      order: { occurredAt: 'ASC', id: 'ASC' },
      take: Math.max(1, limit),
    });
    return found.map((orm) => ({
      id: orm.id,
      eventName: orm.eventName,
      payload: orm.payload,
      occurredAt: orm.occurredAt,
    }));
  }
}
