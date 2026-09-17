import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserOrmEntity } from "../entities/user.orm-entity.js";
import { UserPersistenceAssembler } from "../assemblers/user-persistence.assembler.js";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { UserId } from "../../../../domain/model/valueobjects/user-id.value-object.js";
import { User } from "../../../../domain/model/aggregates/user.aggregate.js";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { UserRepository } from "../../../../domain/repositories/user.repository.js";

/**
 * TypeORM implementation of the {@link UserRepository} domain port.
 *
 * Reads the transactional EntityManager from TransactionContext so every
 * call inside `UNIT_OF_WORK.run()` joins the same transaction (skill v1.0.9:
 * translate via `getRepository`, never `?? this.orm` on a possibly-null union).
 * Finders are named in ubiquitous language and deal in whole aggregates.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class UserRepositoryImpl implements UserRepository {
  /**
   * Creates the adapter over the TypeORM repository and the assembler.
   * @param userRepository Injected TypeORM repository for standalone reads.
   * @param assembler Translates rows to aggregates and back.
   */
  constructor(
    @InjectRepository(UserOrmEntity) private readonly userRepository: Repository<UserOrmEntity>,
    private readonly assembler: UserPersistenceAssembler,
  ) {}

  /**
   * Resolves the repository bound to the running transaction when present.
   */
  private get repository(): Repository<UserOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(UserOrmEntity) : this.userRepository;
  }

  /**
   * Finds a user by its technical identity id.
   * @inheritdoc
   */
  async findById(id: UserId): Promise<User | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds a user by its recorded contact email.
   * @inheritdoc
   */
  async findByEmail(email: string): Promise<User | null> {
    const found = await this.repository.findOne({ where: { email } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds a user by its referenced person id.
   * @inheritdoc
   */
  async findByPersonId(personId: PersonId): Promise<User | null> {
    const found = await this.repository.findOne({ where: { personId: personId.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Persists the whole aggregate state in one row.
   * @inheritdoc
   */
  async save(user: User): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(user);
    await this.repository.save(ormEntity);
  }
}
