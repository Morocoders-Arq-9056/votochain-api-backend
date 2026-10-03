import { Not, Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { Membership, MembershipStatus } from "../../../../domain/model/aggregates/membership.aggregate.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { MembershipId } from "../../../../domain/model/valueobjects/membership-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { MembershipRepository } from "../../../../domain/repositories/membership.repository.js";
import { MembershipPersistenceAssembler } from "../assemblers/membership-persistence.assembler.js";
import { MembershipOrmEntity } from "../entities/membership.orm-entity.js";

/**
 * TypeORM implementation of the {@link MembershipRepository} domain port.
 *
 * Reads the transactional EntityManager from TransactionContext so every
 * call inside `UNIT_OF_WORK.run()` joins the same transaction (skill v1.0.9:
 * translate via `getRepository`, never `?? this.orm` on a possibly-null union).
 * Finders are named in ubiquitous language and deal in whole aggregates.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipRepositoryImpl implements MembershipRepository {
  /**
   * Creates the adapter over the TypeORM repository and the assembler.
   * @param membershipRepository Injected TypeORM repository for standalone reads.
   * @param assembler Translates rows to aggregates and back.
   */
  constructor(
    @InjectRepository(MembershipOrmEntity) private readonly membershipRepository: Repository<MembershipOrmEntity>,
    private readonly assembler: MembershipPersistenceAssembler,
  ) {}

  /**
   * Resolves the repository bound to the running transaction when present.
   */
  private get repository(): Repository<MembershipOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(MembershipOrmEntity) : this.membershipRepository;
  }

  /**
   * Finds a membership by its identity, whatever its standing.
   * @inheritdoc
   */
  async findById(id: MembershipId): Promise<Membership | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds the live (non-terminated) membership for a pair, or null.
   * @inheritdoc
   */
  async findLiveByPersonAndCommunity(personId: PersonId, communityId: CommunityId): Promise<Membership | null> {
    const found = await this.repository.findOne({
      where: {
        personId: personId.value,
        communityId: communityId.value,
        status: Not(MembershipStatus.TERMINATED),
      },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds the ACTIVE memberships of a community (the roster).
   * @inheritdoc
   */
  async findActiveByCommunity(communityId: CommunityId): Promise<Membership[]> {
    const found = await this.repository.find({
      where: { communityId: communityId.value, status: MembershipStatus.ACTIVE },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  /**
   * Finds the live memberships held by a person.
   * @inheritdoc
   */
  async findLiveByPerson(personId: PersonId): Promise<Membership[]> {
    const found = await this.repository.find({
      where: { personId: personId.value, status: Not(MembershipStatus.TERMINATED) },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  /**
   * Persists the whole aggregate state in one row.
   * @inheritdoc
   */
  async save(membership: Membership): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(membership);
    await this.repository.save(ormEntity);
  }
}
