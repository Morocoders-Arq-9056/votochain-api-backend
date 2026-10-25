import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppReadyListener } from './application/internal/eventhandlers/app-ready.listener.js';
import { OutboxRelayService } from './application/internal/outbox/outbox-relay.service.js';
import { UNIT_OF_WORK } from './domain/repositories/unit-of-work.js';
import { OUTBOX_STORE } from './domain/repositories/outbox-store.js';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm/repositories/unit-of-work.impl.js';
import { OutboxStoreImpl } from './infrastructure/persistence/typeorm/outbox/outbox-store.impl.js';
import { OutboxRecordOrmEntity } from './infrastructure/persistence/typeorm/entities/outbox-record.orm-entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxRecordOrmEntity])],
  providers: [
    AppReadyListener,
    OutboxRelayService,
    { provide: OUTBOX_STORE, useClass: OutboxStoreImpl },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
  exports: [UNIT_OF_WORK, OUTBOX_STORE],
})
export class SharedModule {}
