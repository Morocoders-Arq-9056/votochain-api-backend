import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { Proposal, type Proposable } from "../../../domain/model/aggregates/proposal.aggregate.js";
import { CloseProposalCommand } from "../../../domain/model/commands/close-proposal.command.js";
import { DraftProposalCommand } from "../../../domain/model/commands/draft-proposal.command.js";
import { OpenProposalCommand } from "../../../domain/model/commands/open-proposal.command.js";
import { TallyProposalCommand } from "../../../domain/model/commands/tally-proposal.command.js";
import { ProposalId } from "../../../domain/model/valueobjects/proposal-id.value-object.js";
import { ProposalNotFoundError } from "../../../domain/exceptions/proposal-not-found.error.js";
import { PROPOSAL_REPOSITORY } from "../../../domain/repositories/proposal.repository.js";
import type { ProposalRepository } from "../../../domain/repositories/proposal.repository.js";
import { VOTE_REPOSITORY } from "../../../domain/repositories/vote.repository.js";
import type { VoteRepository } from "../../../domain/repositories/vote.repository.js";
import { ProposalCommandService } from "../../../domain/services/proposal-command.service.js";
import { ExternalCommunityService } from "../outboundservices/acl/external-community.service.js";

/**
 * Application orchestration for proposal writes: UC1 draft, UC2 open
 * (policy via R1, frozen once), UC7 close, UC8 tally.
 *
 * UC8 (H4 intent-vs-fact): the tally counts CONFIRMED votes only, read
 * against the quorum snapshot frozen at open() (TECH-DEBT-01 closed Sprint-04).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ProposalCommandServiceImpl implements ProposalCommandService {
  constructor(
    @Inject(PROPOSAL_REPOSITORY) private readonly proposals: ProposalRepository,
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    private readonly community: ExternalCommunityService,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async draftProposal(command: DraftProposalCommand): Promise<ProposalId> {
    const proposal = await this.uow.run(async () => {
      const p = Proposal.create(ProposalId.generate(), command.communityId, command.options);
      await this.proposals.save(p);
      return p;
    });
    this.publish(proposal);
    return proposal.id;
  }

  async openProposal(command: OpenProposalCommand): Promise<void> {
    const proposal = await this.require(command.proposalId.value);
    const policy = await this.community.getPolicy(proposal.communityId.value);
    if (!policy) throw new ProposalNotFoundError('community policy undefined');
    const updated = await this.uow.run(async () => {
      const p = await this.require(command.proposalId.value);
      p.open(policy);
      await this.proposals.save(p);
      return p;
    });
    this.publish(updated);
  }

  async closeProposal(command: CloseProposalCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const p = await this.require(command.proposalId.value);
      p.close();
      await this.proposals.save(p);
      return p;
    });
    this.publish(updated);
  }

  async tallyProposal(command: TallyProposalCommand): Promise<void> {
    // H4: CONFIRMED-only — SIGNED/QUEUED/SENT never feed the tally.
    // The snapshot read runs inside the unit of work so the counts and the
    // tally write share one transaction.
    const updated = await this.uow.run(async () => {
      const stored = await this.votes.findConfirmedByProposal(command.proposalId);
      const counts = new Map<string, number>();
      for (const v of stored) counts.set(v.choice.value, (counts.get(v.choice.value) ?? 0) + 1);
      const p = await this.require(command.proposalId.value);
      p.tallyVotes(counts, stored.length);
      await this.proposals.save(p);
      return p;
    });
    this.publish(updated);
  }

  private async require(id: string): Promise<Proposal> {
    const proposal = await this.proposals.findById(ProposalId.of(id));
    if (!proposal) throw new ProposalNotFoundError('proposal not found');
    return proposal;
  }

  private publish(proposal: Proposable & { pullDomainEvents(): { eventName: string }[] }): void {
    for (const e of proposal.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
