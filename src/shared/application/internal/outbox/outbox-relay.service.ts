import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { OutboxRecord, OutboxStore } from '../../../domain/repositories/outbox-store.js';
import { OUTBOX_STORE } from '../../../domain/repositories/outbox-store.js';

/**
 * Outbox relay: startup recovery + periodic sweep over unpublished rows.
 * Emits each row's plain-JSON payload under its wire `eventName`, then marks
 * it published. At-least-once by design — every handler is idempotent by
 * standing guards (re-queues, UNIQUE races replay as success).
 *
 * Tunables (`process.env`, defaults in parentheses):
 * `OUTBOX_SWEEP_MS` (30000), `OUTBOX_SWEEP_BATCH` (100),
 * `OUTBOX_SWEEP_ENABLED` ('true'), `OUTBOX_STARTUP_RECOVERY` ('true').
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    if (process.env.OUTBOX_STARTUP_RECOVERY !== 'false') {
      void this.dispatchUnpublished('startup').catch((e) =>
        this.logger.error(`outbox startup recovery failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    }
    if (process.env.OUTBOX_SWEEP_ENABLED === 'false') return;
    const ms = Number(process.env.OUTBOX_SWEEP_MS ?? 30000);
    this.timer = setInterval(
      () => void this.dispatchUnpublished('sweep').catch((e) =>
        this.logger.error(`outbox sweep failed: ${e instanceof Error ? e.message : String(e)}`),
      ),
      Number.isFinite(ms) && ms > 0 ? ms : 30000,
    );
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async dispatchUnpublished(reason: string): Promise<number> {
    const batch = Number(process.env.OUTBOX_SWEEP_BATCH ?? 100);
    const rows: OutboxRecord[] = await this.outbox.findUnpublished(
      Number.isFinite(batch) && batch > 0 ? batch : 100,
    );
    let dispatched = 0;
    for (const row of rows) {
      try {
        this.events.emit(row.eventName, { ...row.payload, eventName: row.eventName, occurredAt: new Date(row.occurredAt) });
        await this.outbox.markPublished([row.id]);
        dispatched++;
      } catch (e) {
        this.logger.error(`outbox ${reason} dispatch failed for ${row.id} (${row.eventName}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (dispatched > 0) this.logger.log(`outbox ${reason} dispatched ${dispatched} event(s)`);
    return dispatched;
  }
}
