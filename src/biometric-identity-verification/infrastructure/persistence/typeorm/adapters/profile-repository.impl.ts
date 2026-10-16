import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { BiometricProfile } from "../../../../domain/model/aggregates/biometric-profile.aggregate.js";
import { BiometricProfileId } from "../../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { ProfileStanding } from "../../../../domain/model/valueobjects/profile-standing.value-object.js";
import type { ProfileRepository } from "../../../../domain/repositories/profile.repository.js";
import { ProfilePersistenceAssembler } from "../assemblers/profile-persistence.assembler.js";
import { ProfileOrmEntity } from "../entities/profile.orm-entity.js";

/** TypeORM implementation of the {@link ProfileRepository} port. */
@Injectable()
export class ProfileRepositoryImpl implements ProfileRepository {
  constructor(
    @InjectRepository(ProfileOrmEntity) private readonly orm: Repository<ProfileOrmEntity>,
    private readonly assembler: ProfilePersistenceAssembler,
  ) {}

  private get repository(): Repository<ProfileOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ProfileOrmEntity) : this.orm;
  }

  async findById(id: BiometricProfileId): Promise<BiometricProfile | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findLiveByPerson(personId: PersonId): Promise<BiometricProfile | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value, standing: ProfileStanding.ENROLLED },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async save(profile: BiometricProfile): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(profile));
  }
}
