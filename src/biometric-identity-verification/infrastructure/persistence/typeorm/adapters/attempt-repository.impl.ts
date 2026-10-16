import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { VerificationAttempt } from "../../../../domain/model/aggregates/verification-attempt.aggregate.js";
import { AttemptStanding } from "../../../../domain/model/valueobjects/attempt-standing.value-object.js";
import { BiometricProfileId } from "../../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../../../../domain/model/valueobjects/verification-attempt-id.value-object.js";
import type { AttemptRepository } from "../../../../domain/repositories/attempt.repository.js";
import { AttemptPersistenceAssembler } from "../assemblers/attempt-persistence.assembler.js";
import { AttemptOrmEntity } from "../entities/attempt.orm-entity.js";

const OPEN_STANDINGS = [
  AttemptStanding.CHALLENGE_OPEN,
  AttemptStanding.LIVENESS_PASSED,
  AttemptStanding.COMPARISON_REQUESTED,
];

/** TypeORM implementation of the {@link AttemptRepository} port. */
@Injectable()
export class AttemptRepositoryImpl implements AttemptRepository {
  constructor(
    @InjectRepository(AttemptOrmEntity) private readonly orm: Repository<AttemptOrmEntity>,
    private readonly assembler: AttemptPersistenceAssembler,
  ) {}

  private get repository(): Repository<AttemptOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(AttemptOrmEntity) : this.orm;
  }

  async findById(id: VerificationAttemptId): Promise<VerificationAttempt | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findLatestByPerson(personId: PersonId): Promise<VerificationAttempt | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value },
      order: { createdAt: 'DESC' },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findAllByPerson(personId: PersonId): Promise<VerificationAttempt[]> {
    const found = await this.repository.find({
      where: { personId: personId.value },
      order: { createdAt: 'DESC' },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async findOpenByProfile(profileId: BiometricProfileId): Promise<VerificationAttempt[]> {
    const found = await this.repository.find({
      where: { profileId: profileId.value, standing: In(OPEN_STANDINGS) },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async save(attempt: VerificationAttempt): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(attempt));
  }
}
