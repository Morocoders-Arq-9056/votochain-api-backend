import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import type { ConsentRecord } from "../../../../domain/model/aggregates/consent-record.aggregate.js";
import type { DataSubjectRequest } from "../../../../domain/model/aggregates/data-subject-request.aggregate.js";
import type { RetentionPolicy } from "../../../../domain/model/aggregates/retention-policy.aggregate.js";
import { ConsentStanding, ErasureStanding } from "../../../../domain/model/valueobjects/consent-standings.value-object.js";
import type { ConsentScope } from "../../../../domain/model/valueobjects/consent-scope.value-object.js";
import type { DataCategory } from "../../../../domain/model/valueobjects/data-category.value-object.js";
import type { DataSubjectRequestId } from "../../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { ConsentAlreadyGrantedError } from "../../../../domain/exceptions/consent-already-granted.error.js";
import { ErasureAlreadyOpenError } from "../../../../domain/exceptions/erasure-already-open.error.js";
import { CONSENT_REPOSITORY } from "../../../../domain/repositories/consent.repository.js";
import type { ConsentRepository } from "../../../../domain/repositories/consent.repository.js";
import { ERASURE_REPOSITORY } from "../../../../domain/repositories/erasure.repository.js";
import type { ErasureRepository } from "../../../../domain/repositories/erasure.repository.js";
import { RETENTION_REPOSITORY } from "../../../../domain/repositories/retention.repository.js";
import type { RetentionRepository } from "../../../../domain/repositories/retention.repository.js";
import { ConsentPersistenceAssembler, ErasurePersistenceAssembler, RetentionPersistenceAssembler } from "../assemblers/consent-persistence.assembler.js";
import { ConsentOrmEntity, ErasureRequestOrmEntity, RetentionPolicyOrmEntity } from "../entities/consent.orm-entities.js";

const OPEN_ERASURE = [
  ErasureStanding.REQUESTED,
  ErasureStanding.CONFIRMED,
  ErasureStanding.COORDINATED,
  ErasureStanding.AWAITING_CONFIRMATIONS,
];

@Injectable()
export class ConsentRepositoryImpl implements ConsentRepository {
  constructor(
    @InjectRepository(ConsentOrmEntity) private readonly orm: Repository<ConsentOrmEntity>,
    private readonly assembler: ConsentPersistenceAssembler,
  ) {}

  private get repository(): Repository<ConsentOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ConsentOrmEntity) : this.orm;
  }

  async findLive(personId: PersonId, scope: ConsentScope): Promise<ConsentRecord | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value, scope: scope.value, standing: ConsentStanding.GRANTED },
    });
    return found ? this.assembler.toConsentDomain(found) : null;
  }

  async findHistory(personId: PersonId): Promise<ConsentRecord[]> {
    const found = await this.repository.find({
      where: { personId: personId.value },
      order: { createdAt: 'ASC' },
    });
    return found.map((e) => this.assembler.toConsentDomain(e));
  }

  async save(record: ConsentRecord): Promise<void> {
    try {
      await this.repository.save(this.assembler.toConsentOrm(record));
    } catch (e) {
      if (e instanceof QueryFailedError && (e as unknown as { code?: string }).code === '23505') {
        throw new ConsentAlreadyGrantedError();
      }
      throw e;
    }
  }
}

@Injectable()
export class ErasureRepositoryImpl implements ErasureRepository {
  constructor(
    @InjectRepository(ErasureRequestOrmEntity) private readonly orm: Repository<ErasureRequestOrmEntity>,
    private readonly assembler: ErasurePersistenceAssembler,
  ) {}

  private get repository(): Repository<ErasureRequestOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ErasureRequestOrmEntity) : this.orm;
  }

  async findById(id: DataSubjectRequestId): Promise<DataSubjectRequest | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomain(found) : null;
  }

  async findOpenByPerson(personId: PersonId): Promise<DataSubjectRequest | null> {
    const found = await this.repository.createQueryBuilder('r')
      .where('r.personId = :person', { person: personId.value })
      .andWhere('r.standing IN (:...open)', { open: OPEN_ERASURE })
      .getOne();
    return found ? this.assembler.toDomain(found) : null;
  }

  async findLatestByPerson(personId: PersonId): Promise<DataSubjectRequest | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value },
      order: { createdAt: 'DESC' },
    });
    return found ? this.assembler.toDomain(found) : null;
  }

  async save(request: DataSubjectRequest): Promise<void> {
    try {
      await this.repository.save(this.assembler.toOrm(request));
    } catch (e) {
      if (e instanceof QueryFailedError && (e as unknown as { code?: string }).code === '23505') {
        throw new ErasureAlreadyOpenError();
      }
      throw e;
    }
  }
}

@Injectable()
export class RetentionRepositoryImpl implements RetentionRepository {
  constructor(
    @InjectRepository(RetentionPolicyOrmEntity) private readonly orm: Repository<RetentionPolicyOrmEntity>,
    private readonly assembler: RetentionPersistenceAssembler,
  ) {}

  private get repository(): Repository<RetentionPolicyOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(RetentionPolicyOrmEntity) : this.orm;
  }

  async findLatestByCategory(category: DataCategory): Promise<RetentionPolicy | null> {
    const found = await this.repository.findOne({
      where: { category: category.value },
      order: { createdAt: 'DESC' },
    });
    return found ? this.assembler.toDomain(found) : null;
  }

  async save(policy: RetentionPolicy): Promise<void> {
    await this.repository.save(this.assembler.toOrm(policy));
  }
}

export { CONSENT_REPOSITORY, ERASURE_REPOSITORY, RETENTION_REPOSITORY };
