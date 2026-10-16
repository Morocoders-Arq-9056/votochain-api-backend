import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { IllegalProposalTransitionError } from "../../exceptions/illegal-proposal-transition.error.js";
import { InvalidChoiceError } from "../../exceptions/invalid-choice.error.js";
import { ProposalNotOpenError } from "../../exceptions/proposal-not-open.error.js";
import { ProposalClosedEvent } from "../events/proposal-closed.event.js";
import { ProposalDraftedEvent } from "../events/proposal-drafted.event.js";
import { ProposalOpenedEvent } from "../events/proposal-opened.event.js";
import { ProposalTalliedEvent } from "../events/proposal-tallied.event.js";
import { QuorumNotReachedEvent } from "../events/quorum-not-reached.event.js";
import { QuorumReachedEvent } from "../events/quorum-reached.event.js";
import { BallotOptions } from "../valueobjects/ballot-options.value-object.js";
import { Choice } from "../valueobjects/choice.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { ProposalStatus } from "../valueobjects/proposal-status.value-object.js";
import { QuorumSnapshot } from "../valueobjects/quorum-snapshot.value-object.js";
import { Tally } from "../valueobjects/tally.value-object.js";

/**
 * Lifecycle contract of a proposal: draft, open once with a frozen quorum,
 * close, then tally.
 */
export interface Proposable {
  open(quorum: QuorumSnapshot): void;
  close(): void;
  tallyVotes(counts: ReadonlyMap<string, number>, turnout: number): void;
}

/**
 * Proposal aggregate: DRAFT → OPEN → CLOSED → TALLIED. Never contains votes —
 * the tally carries counts only, and votes live in their own aggregate by
 * identity reference.
 */
export class Proposal extends AggregateRoot implements Proposable {
  private constructor(
    private readonly _id: ProposalId,
    private readonly _communityId: CommunityId,
    private _status: ProposalStatus,
    private readonly _options: BallotOptions,
    private _quorum: QuorumSnapshot | null,
    private _tally: Tally | null,
  ) { super(); }

  static create(id: ProposalId, communityId: CommunityId, options: BallotOptions): Proposal {
    if (options.size < 2) throw new InvalidChoiceError('ballot needs >= 2 options');
    const proposal = new Proposal(id, communityId, ProposalStatus.DRAFT, options, null, null);
    proposal.registerEvent(new ProposalDraftedEvent(id, communityId));
    return proposal;
  }

  static rehydrate(input: { id: ProposalId; communityId: CommunityId; status: ProposalStatus; options: BallotOptions; quorum: QuorumSnapshot | null; tally: Tally | null }): Proposal {
    return new Proposal(input.id, input.communityId, input.status, input.options, input.quorum, input.tally);
  }

  open(quorum: QuorumSnapshot): void {
    if (this._status !== ProposalStatus.DRAFT) throw new IllegalProposalTransitionError('open only from DRAFT');
    this._quorum = quorum;
    this._status = ProposalStatus.OPEN;
    this.registerEvent(new ProposalOpenedEvent(this._id, quorum));
  }

  close(): void {
    if (this._status !== ProposalStatus.OPEN) throw new IllegalProposalTransitionError('close only from OPEN');
    this._status = ProposalStatus.CLOSED;
    this.registerEvent(new ProposalClosedEvent(this._id, new Date()));
  }

  tallyVotes(counts: ReadonlyMap<string, number>, turnout: number): void {
    if (this._status !== ProposalStatus.CLOSED) throw new IllegalProposalTransitionError('tally only from CLOSED');
    if (!this._quorum) throw new IllegalProposalTransitionError('quorum never frozen');
    this._tally = Tally.compute({ counts, turnout, quorumMet: this._quorum.verdictFor(turnout) });
    this._status = ProposalStatus.TALLIED;
    this.registerEvent(new ProposalTalliedEvent(this._id, this._tally));
    this.registerEvent(this._tally.quorumMet
      ? new QuorumReachedEvent(this._id, turnout)
      : new QuorumNotReachedEvent(this._id, turnout));
  }

  assertOpen(): void {
    if (this._status !== ProposalStatus.OPEN) throw new ProposalNotOpenError('ProposalNotOpen');
  }

  /** Answers whether votes may still be cast (status OPEN). */
  isOpen(): boolean { return this._status === ProposalStatus.OPEN; }

  assertChoice(choice: Choice): void {
    if (!this._options.contains(choice)) throw new InvalidChoiceError('InvalidChoice');
  }

  get id(): ProposalId { return this._id; }
  get communityId(): CommunityId { return this._communityId; }
  get status(): ProposalStatus { return this._status; }
  get options(): BallotOptions { return this._options; }
  get quorum(): QuorumSnapshot | null { return this._quorum; }
  get tally(): Tally | null { return this._tally; }
}
