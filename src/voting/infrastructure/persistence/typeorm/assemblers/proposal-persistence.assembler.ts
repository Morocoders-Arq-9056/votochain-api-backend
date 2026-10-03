import { Injectable } from "@nestjs/common";
import { Proposal } from "../../../../domain/model/aggregates/proposal.aggregate.js";
import { BallotOptions } from "../../../../domain/model/valueobjects/ballot-options.value-object.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { parseProposalStatus } from "../../../../domain/model/valueobjects/proposal-status.value-object.js";
import { QuorumSnapshot } from "../../../../domain/model/valueobjects/quorum-snapshot.value-object.js";
import { Tally } from "../../../../domain/model/valueobjects/tally.value-object.js";
import { ProposalOrmEntity } from "../entities/proposal.orm-entity.js";

/**
 * Translates between the `Proposal` aggregate and its row. Every status
 * string goes through `parseProposalStatus` (never `as`).
 */
@Injectable()
export class ProposalPersistenceAssembler {
  toDomainFromOrm(entity: ProposalOrmEntity): Proposal {
    return Proposal.rehydrate({
      id: ProposalId.of(entity.id),
      communityId: CommunityId.of(entity.communityId),
      status: parseProposalStatus(entity.status),
      options: BallotOptions.of(entity.options),
      quorum: entity.quorumSnapshot
        ? QuorumSnapshot.freeze({ threshold: entity.quorumSnapshot.threshold, basis: entity.quorumSnapshot.basis })
        : null,
      tally: entity.tally
        ? Tally.compute({ counts: new Map(Object.entries(entity.tally.counts)), turnout: entity.tally.turnout, quorumMet: entity.tally.quorumMet })
        : null,
    });
  }

  toOrmFromDomain(proposal: Proposal): ProposalOrmEntity {
    const orm = new ProposalOrmEntity();
    orm.id = proposal.id.value;
    orm.communityId = proposal.communityId.value;
    orm.status = proposal.status;
    orm.options = proposal.options.values;
    orm.quorumSnapshot = proposal.quorum ? { threshold: proposal.quorum.threshold, basis: proposal.quorum.basis } : null;
    const tally = proposal.tally;
    orm.tally = tally ? { counts: tally.toRecord(), turnout: tally.turnout, quorumMet: tally.quorumMet } : null;
    return orm;
  }
}
