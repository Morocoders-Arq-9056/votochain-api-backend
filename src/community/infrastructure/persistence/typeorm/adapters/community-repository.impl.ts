import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { Community } from "../../../../domain/model/aggregates/community.aggregate.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { CommunityRepository } from "../../../../domain/repositories/community.repository.js";
import { CommunityPersistenceAssembler } from "../assemblers/community-persistence.assembler.js";
import { CommunityOrmEntity } from "../entities/community.orm-entity.js";

/**
 * TypeORM implementation of the {@link CommunityRepository} domain port.
 *
 * Reads the transactional EntityManager from TransactionContext so every
 * call inside `UNIT_OF_WORK.run()` joins the same transaction (skill v1.0.9:
 * translate via `getRepository`, never `?? this.orm` on a possibly-null union).
 * Finders are named in ubiquitous language and deal in whole aggregates.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityRepositoryImpl implements CommunityRepository {
  /**
   * Creates the adapter over the TypeORM repository and the assembler.
   * @param communityRepository Injected TypeORM repository for standalone reads.
   * @param assembler Translates rows to aggregates and back.
   */
  constructor(
    @InjectRepository(CommunityOrmEntity) private readonly communityRepository: Repository<CommunityOrmEntity>,
    private readonly assembler: CommunityPersistenceAssembler,
  ) {}

  /**
   * Resolves the repository bound to the running transaction when present.
   */
  private get repository(): Repository<CommunityOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(CommunityOrmEntity) : this.communityRepository;
  }

  /**
   * Finds a community by its identity.
   * @inheritdoc
   */
  async findById(id: CommunityId): Promise<Community | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds a community by its name for the UC1 uniqueness guard.
   * @inheritdoc
   */
  async findByName(name: string): Promise<Community | null> {
    const found = await this.repository.findOne({ where: { name } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Persists the whole aggregate state in one row.
   * @inheritdoc
   */
  async save(community: Community): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(community);
    await this.repository.save(ormEntity);
  }
}
