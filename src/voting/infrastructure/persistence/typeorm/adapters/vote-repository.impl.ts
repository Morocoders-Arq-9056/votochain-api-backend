import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { Vote } from "../../../../domain/model/aggregates/vote.aggregate.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { VoteId } from "../../../../domain/model/valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../../../../domain/model/valueobjects/voter-address.value-object.js";
import { VoteStatus } from "../../../../domain/model/valueobjects/vote-status.value-object.js";
import type { VoteRepository } from "../../../../domain/repositories/vote.repository.js";
import { VotePersistenceAssembler } from "../assemblers/vote-persistence.assembler.js";
import { VoteOrmEntity } from "../entities/vote.orm-entity.js";

/**
 * TypeORM implementation of the {@link VoteRepository} port. Joins the
 * running UoW transaction via TransactionContext.
 *
 * TECH-DEBT-01: `findConfirmedByProposal` currently returns every stored
 * vote regardless of tracking status (stand-in while InstantConfirm makes
 * every vote confirmed). Sprint-04 narrows the WHERE to CONFIRMED-only.
 */
@Injectable()
export class VoteRepositoryImpl implements VoteRepository {
  constructor(
    @InjectRepository(VoteOrmEntity) private readonly orm: Repository<VoteOrmEntity>,
    private readonly assembler: VotePersistenceAssembler,
  ) {}

  private get repository(): Repository<VoteOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(VoteOrmEntity) : this.orm;
  }

  async findById(id: VoteId): Promise<Vote | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findByProposalAndVoter(proposalId: ProposalId, voter: VoterAddress): Promise<Vote | null> {
    const found = await this.repository.findOne({
      where: { proposalId: proposalId.value, voterAddress: voter.value, status: VoteStatus.CONFIRMED },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findConfirmedByProposal(proposalId: ProposalId): Promise<Vote[]> {
    // TECH-DEBT-01 stand-in: counts SIGNED/QUEUED/CONFIRMED for now;
    // Sprint-04 enforces CONFIRMED-only (H4). See tallyProposal.
    const found = await this.repository.find({ where: { proposalId: proposalId.value } });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async save(vote: Vote): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(vote));
  }
}
