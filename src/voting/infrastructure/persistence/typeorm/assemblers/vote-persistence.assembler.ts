import { Injectable } from "@nestjs/common";
import { Vote } from "../../../../domain/model/aggregates/vote.aggregate.js";
import { Choice } from "../../../../domain/model/valueobjects/choice.value-object.js";
import { EIP712Signature } from "../../../../domain/model/valueobjects/eip712-signature.value-object.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { TransactionReference } from "../../../../domain/model/valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../../../../domain/model/valueobjects/vote-id.value-object.js";
import { VoteNonce } from "../../../../domain/model/valueobjects/vote-nonce.value-object.js";
import { VoterAddress } from "../../../../domain/model/valueobjects/voter-address.value-object.js";
import { parseVoteStatus } from "../../../../domain/model/valueobjects/vote-status.value-object.js";
import { VoteOrmEntity } from "../entities/vote.orm-entity.js";

/**
 * Translates between the `Vote` aggregate and its row. Status strings go
 * through `parseVoteStatus` (never `as`).
 */
@Injectable()
export class VotePersistenceAssembler {
  toDomainFromOrm(entity: VoteOrmEntity): Vote {
    return Vote.rehydrate({
      id: VoteId.of(entity.id),
      proposalId: ProposalId.of(entity.proposalId),
      voterAddress: VoterAddress.of(entity.voterAddress),
      choice: Choice.of(entity.choice),
      nonce: VoteNonce.of(entity.nonce),
      signature: EIP712Signature.create({ v: entity.signature.v, r: entity.signature.r, s: entity.signature.s }),
      reference: entity.txHash ? TransactionReference.of({ txHash: entity.txHash, blockNumber: entity.blockNumber }) : null,
      status: parseVoteStatus(entity.status),
    });
  }

  toOrmFromDomain(vote: Vote): VoteOrmEntity {
    const orm = new VoteOrmEntity();
    orm.id = vote.id.value;
    orm.proposalId = vote.proposalId.value;
    orm.voterAddress = vote.voterAddress.value;
    orm.choice = vote.choice.value;
    orm.nonce = vote.nonce.value;
    orm.signature = { v: vote.signature.v, r: vote.signature.r, s: vote.signature.s };
    orm.txHash = vote.reference?.txHash ?? null;
    orm.blockNumber = vote.reference?.blockNumber ?? null;
    orm.status = vote.status;
    return orm;
  }
}
