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
 * H4 intent-vs-fact: `findConfirmedByProposal` answers CONFIRMED-only —
 * only ledger-confirmed votes feed the tally (TECH-DEBT-01 closed Sprint-04).
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
    // H4: only CONFIRMED counts toward the tally (TECH-DEBT-01 closed).
    const found = await this.repository.find({
      where: { proposalId: proposalId.value, status: VoteStatus.CONFIRMED },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async save(vote: Vote): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(vote));
  }
}
