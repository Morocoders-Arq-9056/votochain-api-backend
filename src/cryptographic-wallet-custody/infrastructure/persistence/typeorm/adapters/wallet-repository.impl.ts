import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import type { DomainEvent } from "../../../../../shared/domain/model/domain-event.js";
import { UserWallet } from "../../../../domain/model/aggregates/user-wallet.aggregate.js";
import { DerivationPosition } from "../../../../domain/model/valueobjects/derivation-position.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { UserWalletId } from "../../../../domain/model/valueobjects/user-wallet-id.value-object.js";
import { WalletStanding } from "../../../../domain/model/valueobjects/wallet-standing.value-object.js";
import type { WalletRepository } from "../../../../domain/repositories/wallet.repository.js";
import { WalletPersistenceAssembler } from "../assemblers/wallet-persistence.assembler.js";
import { WalletEventOrmEntity } from "../entities/wallet-event.orm-entity.js";
import { WalletOrmEntity } from "../entities/wallet.orm-entity.js";

/**
 * TypeORM implementation of the {@link WalletRepository} port. Joins the
 * running UoW transaction via TransactionContext. `save()` persists the
 * aggregate row and appends its buffered (peeked, never drained) events to
 * `wallet.events` in the same unit of work — the command service still
 * drains the same facts for the bus after commit.
 */
@Injectable()
export class WalletRepositoryImpl implements WalletRepository {
  constructor(
    @InjectRepository(WalletOrmEntity) private readonly orm: Repository<WalletOrmEntity>,
    @InjectRepository(WalletEventOrmEntity) private readonly eventOrm: Repository<WalletEventOrmEntity>,
    private readonly assembler: WalletPersistenceAssembler,
  ) {}

  private get repository(): Repository<WalletOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(WalletOrmEntity) : this.orm;
  }

  private get eventRepository(): Repository<WalletEventOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(WalletEventOrmEntity) : this.eventOrm;
  }

  async findById(id: UserWalletId): Promise<UserWallet | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findLiveByPerson(personId: PersonId): Promise<UserWallet | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value, standing: WalletStanding.PROVISIONED },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findNonRetiredByPerson(personId: PersonId): Promise<UserWallet[]> {
    const found = await this.repository.find({
      where: { personId: personId.value, standing: Not(WalletStanding.RETIRED) },
    });
    return found.map((orm) => this.assembler.toDomainFromOrm(orm));
  }

  async existsPosition(position: DerivationPosition): Promise<boolean> {
    const found = await this.repository.findOne({ where: { derivationPosition: position.value } });
    return found !== null;
  }

  async nextPosition(): Promise<number> {
    const max = await this.repository
      .createQueryBuilder('w')
      .select('MAX(w.derivationPosition)', 'max')
      .getRawOne<{ max: number | null }>();
    return (max?.max ?? -1) + 1;
  }

  async save(wallet: UserWallet): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(wallet));
    const events = wallet.peekDomainEvents();
    for (const event of events) {
      const row = new WalletEventOrmEntity();
      row.walletId = wallet.id.value;
      row.eventName = event.eventName;
      row.payload = this.assembler.toPayload(event);
      row.occurredAt = event.occurredAt;
      await this.eventRepository.save(row);
    }
  }

  async findEventsByWallet(id: UserWalletId): Promise<DomainEvent[]> {
    const rows = await this.eventRepository.find({
      where: { walletId: id.value },
      order: { seq: 'ASC' },
    });
    return rows.map((r) => this.assembler.toDomainEvent(r.eventName, r.payload, r.occurredAt));
  }
}
