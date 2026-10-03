import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { Proposal } from "../../../../domain/model/aggregates/proposal.aggregate.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { ProposalStatus } from "../../../../domain/model/valueobjects/proposal-status.value-object.js";
import type { ProposalRepository } from "../../../../domain/repositories/proposal.repository.js";
import { ProposalPersistenceAssembler } from "../assemblers/proposal-persistence.assembler.js";
import { ProposalOrmEntity } from "../entities/proposal.orm-entity.js";

/**
 * TypeORM implementation of the {@link ProposalRepository} port. Joins the
 * running UoW transaction via TransactionContext.
 */
@Injectable()
export class ProposalRepositoryImpl implements ProposalRepository {
  constructor(
    @InjectRepository(ProposalOrmEntity) private readonly orm: Repository<ProposalOrmEntity>,
    private readonly assembler: ProposalPersistenceAssembler,
  ) {}

  private get repository(): Repository<ProposalOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ProposalOrmEntity) : this.orm;
  }

  async findById(id: ProposalId): Promise<Proposal | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findByCommunityAndStatus(communityId: CommunityId, status: ProposalStatus | null): Promise<Proposal[]> {
    const found = await this.repository.find({
      where: status ? { communityId: communityId.value, status } : { communityId: communityId.value },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async save(proposal: Proposal): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(proposal));
  }
}
