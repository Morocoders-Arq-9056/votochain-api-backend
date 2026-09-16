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

@Injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity) private readonly userRepository: Repository<UserOrmEntity>,
    private readonly assembler: UserPersistenceAssembler,
  ) {}

  private get repository(): Repository<UserOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(UserOrmEntity) : this.userRepository;
  }

  /**
   * @inheritdoc
   */
  async findById(id: UserId): Promise<User | null> {
    const found = await this.repository.findOne({
      where: { id: id.value },
      relations: { assignments: true },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = await this.repository.findOne({
      where : { email },
      relations: { assignments: true },
    })
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findByPersonId(personId: PersonId): Promise<User | null> {
    const found = await this.repository.findOne({
      where : { personId: personId.value },
      relations: { assignments: true },
    })
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }
  
  async save(user: User): Promise<void> {
    const ormEntity = this.assembler.toOrmFromDomain(user);
    await this.repository.save(ormEntity);
  }
}