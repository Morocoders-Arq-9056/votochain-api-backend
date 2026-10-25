import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { VoteAuthorization } from "../../../../domain/model/aggregates/vote-authorization.aggregate.js";
import { AuthorizationId } from "../../../../domain/model/valueobjects/authorization-id.value-object.js";
import { AuthorizationStatus } from "../../../../domain/model/valueobjects/authorization-status.value-object.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../../../../domain/model/valueobjects/voter-address.value-object.js";
import type { VoteAuthorizationRepository } from "../../../../domain/repositories/authorization.repository.js";
import { VoteAuthorizationPersistenceAssembler } from "../assemblers/vote-authorization-persistence.assembler.js";
import { VoteAuthorizationOrmEntity } from "../entities/vote-authorization.orm-entity.js";

/**
 * TypeORM implementation of the {@link VoteAuthorizationRepository} port.
 * Joins the running UoW transaction via TransactionContext.
 */
@Injectable()
export class AuthorizationRepositoryImpl implements VoteAuthorizationRepository {
  constructor(
    @InjectRepository(VoteAuthorizationOrmEntity) private readonly orm: Repository<VoteAuthorizationOrmEntity>,
    private readonly assembler: VoteAuthorizationPersistenceAssembler,
  ) {}

  private get repository(): Repository<VoteAuthorizationOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(VoteAuthorizationOrmEntity) : this.orm;
  }

  async findById(id: AuthorizationId): Promise<VoteAuthorization | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findPendingByProposalAndVoter(proposalId: ProposalId, voter: VoterAddress): Promise<VoteAuthorization | null> {
    const found = await this.repository.findOne({
      where: { proposalId: proposalId.value, voterAddress: voter.value, status: AuthorizationStatus.PENDING },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  /**
   * Expiry-sweep input: PENDING rows past their window, oldest first.
   * @inheritdoc
   */
  async findExpiredPending(now: Date, limit: number): Promise<VoteAuthorization[]> {
    const found = await this.repository.find({
      where: { status: AuthorizationStatus.PENDING, expiresAt: LessThanOrEqual(now) },
      order: { expiresAt: 'ASC' },
      take: Math.max(1, limit),
    });
    return found.map((orm) => this.assembler.toDomainFromOrm(orm));
  }

  async save(auth: VoteAuthorization): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(auth));
  }
}
