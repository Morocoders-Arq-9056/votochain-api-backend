import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { VerificationChallenge } from "../../../../domain/model/aggregates/verification-challenge.aggregate.js";
import { ChallengeId } from "../../../../domain/model/valueobjects/challenge-id.value-object.js";
import { ChallengeStanding } from "../../../../domain/model/valueobjects/challenge-standing.value-object.js";
import { Purpose } from "../../../../domain/model/valueobjects/purpose.value-object.js";
import { VerificationChallengeRepository } from "../../../../domain/repositories/verification-challenge.repository.js";
import { ChallengePersistenceAssembler } from "../assemblers/challenge-persistence.assembler.js";
import { ChallengeOrmEntity } from "../entities/challenge.orm-entity.js";

/**
 * TypeORM implementation of the {@link VerificationChallengeRepository} domain port.
 *
 * Reads the transactional EntityManager from TransactionContext so every
 * call inside `UNIT_OF_WORK.run()` joins the same transaction (skill v1.0.9:
 * translate via `getRepository`, never `?? this.orm` on a possibly-null union).
 * Finders are named in ubiquitous language and deal in whole aggregates.
 * Window-vigency is judged in the domain (`isElapsed`), never in SQL.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ChallengeRepositoryImpl implements VerificationChallengeRepository {
  /**
   * Creates the adapter over the TypeORM repository and the assembler.
   * @param challengeRepository Injected TypeORM repository for standalone reads.
   * @param assembler Translates rows to aggregates and back.
   */
  constructor(
    @InjectRepository(ChallengeOrmEntity) private readonly challengeRepository: Repository<ChallengeOrmEntity>,
    private readonly assembler: ChallengePersistenceAssembler,
  ) {}

  /**
   * Resolves the repository bound to the running transaction when present.
   */
  private get repository(): Repository<ChallengeOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ChallengeOrmEntity) : this.challengeRepository;
  }

  /**
   * Finds a challenge by its identity.
   * @inheritdoc
   */
  async findById(id: ChallengeId): Promise<VerificationChallenge | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds the OPEN challenge for a person and purpose, if any.
   * @inheritdoc
   */
  async findOpenByPersonAndPurpose(personId: PersonId, purpose: Purpose): Promise<VerificationChallenge | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value, purpose, standing: ChallengeStanding.OPEN },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Finds all challenges for a person and purpose in any standing,
   * ordered by request time for the scrutiny history.
   * @inheritdoc
   */
  async findAllByPersonAndPurpose(personId: PersonId, purpose: Purpose): Promise<VerificationChallenge[]> {
    const rows = await this.repository.find({
      where: { personId: personId.value, purpose },
      order: { requestedAt: 'ASC' },
    });
    return rows.map((row) => this.assembler.toDomainFromOrm(row));
  }

  /**
   * Persists the whole aggregate state in one row.
   * @inheritdoc
   */
  async save(challenge: VerificationChallenge): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(challenge);
    await this.repository.save(ormEntity);
  }
}
