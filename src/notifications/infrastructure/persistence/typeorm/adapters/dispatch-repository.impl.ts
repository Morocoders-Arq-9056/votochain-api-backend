import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { NotificationDispatch } from "../../../../domain/model/aggregates/notification-dispatch.aggregate.js";
import { DispatchId } from "../../../../domain/model/valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../../../../domain/model/valueobjects/idempotency-key.value-object.js";
import { NotificationDispatchRepository } from "../../../../domain/repositories/notification-dispatch.repository.js";
import { PersonReference } from "../../../../domain/model/valueobjects/person-reference.value-object.js";
import { DispatchPersistenceAssembler } from "../assemblers/dispatch-persistence.assembler.js";
import { DispatchOrmEntity } from "../entities/dispatch.orm-entity.js";

/**
 * TypeORM implementation of the {@link NotificationDispatchRepository} domain port.
 *
 * Reads the transactional EntityManager from TransactionContext so every
 * call inside `UNIT_OF_WORK.run()` joins the same transaction (skill v1.0.9:
 * translate via `getRepository`, never `?? this.orm` on a possibly-null union).
 * Finders are named in ubiquitous language and deal in whole aggregates.
 * Kept simple: the `UNIQUE(idempotency_key)` violation (23505) surfaces as
 * `QueryFailedError` and is mapped to a DUPLICATE refusal in the command
 * service, where the refused dispatch is persisted.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class DispatchRepositoryImpl implements NotificationDispatchRepository {
  /**
   * Creates the adapter over the TypeORM repository and the assembler.
   * @param dispatchRepository Injected TypeORM repository for standalone reads.
   * @param assembler Translates rows to aggregates and back.
   */
  constructor(
    @InjectRepository(DispatchOrmEntity) private readonly dispatchRepository: Repository<DispatchOrmEntity>,
    private readonly assembler: DispatchPersistenceAssembler,
  ) {}

  /**
   * Resolves the repository bound to the running transaction when present.
   */
  private get repository(): Repository<DispatchOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(DispatchOrmEntity) : this.dispatchRepository;
  }

  /**
   * Finds a dispatch by its idempotency key (duplicate fast-path).
   * @inheritdoc
   */
  async findByKey(key: IdempotencyKey): Promise<NotificationDispatch | null> {
    const found = await this.repository.findOne({ where: { idempotencyKey: key.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds a dispatch by its identity.
   * @inheritdoc
   */
  async findById(id: DispatchId): Promise<NotificationDispatch | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Erasure scan over the `templateValues` jsonb. Matches the exact person
   * reference serialized in the JSON text (no LIKE wildcards from the value:
   * the value is embedded literally between JSON quotes).
   * @inheritdoc
   */
  async findReferencingPerson(person: PersonReference): Promise<NotificationDispatch[]> {
    const needle = `"${person.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const found = await this.repository
      .createQueryBuilder('d')
      .where(`d.templateValues ::text LIKE :needle ESCAPE '\\'`, { needle: `%${needle}%` })
      .getMany();
    return found.map((orm) => this.assembler.toDomainFromOrm(orm));
  }

  /**
   * Persists the whole aggregate state in one row.
   * @inheritdoc
   */
  async save(dispatch: NotificationDispatch): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(dispatch);
    await this.repository.save(ormEntity);
  }
}
