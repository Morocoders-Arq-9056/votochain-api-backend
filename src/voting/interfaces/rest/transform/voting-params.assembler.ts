import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { AuthorizationId } from "../../../domain/model/valueobjects/authorization-id.value-object.js";
import { BallotOptions } from "../../../domain/model/valueobjects/ballot-options.value-object.js";
import { Choice } from "../../../domain/model/valueobjects/choice.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { ProposalId } from "../../../domain/model/valueobjects/proposal-id.value-object.js";
import { ProposalStatus, parseProposalStatus } from "../../../domain/model/valueobjects/proposal-status.value-object.js";
import { VoteId } from "../../../domain/model/valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../../../domain/model/valueobjects/voter-address.value-object.js";
import { IllegalProposalTransitionError } from "../../../domain/exceptions/illegal-proposal-transition.error.js";
import { AuthorizationNotFoundError } from "../../../domain/exceptions/authorization-not-found.error.js";
import { InvalidChoiceError } from "../../../domain/exceptions/invalid-choice.error.js";
import { ProposalNotFoundError } from "../../../domain/exceptions/proposal-not-found.error.js";
import { VoteNotFoundError } from "../../../domain/exceptions/vote-not-found.error.js";

/**
 * Parses voting boundary strings into domain value objects.
 * Corrupt input raises domain rejections so the exception filter maps them.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-29
 */
export class VotingParamsAssembler {
  static toProposalId(id: string): ProposalId {
    try {
      return ProposalId.of(id);
    } catch {
      throw new ProposalNotFoundError('proposal not found');
    }
  }

  static toVoteId(id: string): VoteId {
    try {
      return VoteId.of(id);
    } catch {
      throw new VoteNotFoundError('vote not found');
    }
  }

  static toCommunityId(id: string): CommunityId {
    try {
      return CommunityId.of(id);
    } catch {
      throw new ProposalNotFoundError('community not found');
    }
  }

  static toVoterAddress(address: string): VoterAddress {
    try {
      return VoterAddress.of(address);
    } catch {
      throw new VoteNotFoundError('voter not found');
    }
  }

  static toPersonId(id: string): PersonId {
    try {
      return PersonId.of(id);
    } catch {
      throw new AuthorizationNotFoundError('person not found');
    }
  }

  static toAuthorizationId(id: string): AuthorizationId {
    try {
      return AuthorizationId.of(id);
    } catch {
      throw new AuthorizationNotFoundError('authorization not found');
    }
  }

  static toChoice(choice: string): Choice {
    try {
      return Choice.of(choice);
    } catch {
      throw new InvalidChoiceError('invalid choice');
    }
  }

  static toBallotOptions(options: string[]): BallotOptions {
    try {
      return BallotOptions.of(options);
    } catch {
      throw new InvalidChoiceError('invalid ballot');
    }
  }

  static toProposalStatus(status: string): ProposalStatus {
    try {
      return parseProposalStatus(status);
    } catch {
      throw new IllegalProposalTransitionError('unknown status');
    }
  }
}
