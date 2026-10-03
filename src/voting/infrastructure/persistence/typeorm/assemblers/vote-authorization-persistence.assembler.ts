import { Injectable } from "@nestjs/common";
import { VoteAuthorization } from "../../../../domain/model/aggregates/vote-authorization.aggregate.js";
import { AuthorizationId } from "../../../../domain/model/valueobjects/authorization-id.value-object.js";
import { parseAuthorizationDenialReason, type AuthorizationDenialReason } from "../../../../domain/model/valueobjects/authorization-denial-reason.value-object.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { parseAuthorizationStatus } from "../../../../domain/model/valueobjects/authorization-status.value-object.js";
import { EligibilitySnapshot } from "../../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { ProposalId } from "../../../../domain/model/valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../../../../domain/model/valueobjects/voter-address.value-object.js";
import { VoteAuthorizationOrmEntity } from "../entities/vote-authorization.orm-entity.js";

/**
 * Stored eligibility snapshot node: every field validated before the node
 * is trusted, so a corrupt row throws where the corruption happened.
 */
interface EligibilityNode {
  personId: string;
  communityId: string;
  verdict: string;
  reference: string;
  judgedAt: string;
}

/**
 * Structural guard for a stored eligibility snapshot node.
 */
function isEligibilityNode(json: unknown): json is EligibilityNode {
  if (typeof json !== 'object' || json === null) return false;
  const node = json as Record<string, unknown>;
  return typeof node['personId'] === 'string'
    && typeof node['communityId'] === 'string'
    && typeof node['verdict'] === 'string'
    && typeof node['reference'] === 'string'
    && typeof node['judgedAt'] === 'string';
}

/**
 * Translates between the `VoteAuthorization` aggregate and its row. Status
 * strings go through `parseAuthorizationStatus` (never `as`).
 */
@Injectable()
export class VoteAuthorizationPersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: VoteAuthorizationOrmEntity): VoteAuthorization {
    return VoteAuthorization.rehydrate({
      id: AuthorizationId.of(entity.id),
      proposalId: ProposalId.of(entity.proposalId),
      voterAddress: VoterAddress.of(entity.voterAddress),
      status: parseAuthorizationStatus(entity.status),
      eligibility: this.toEligibility(entity.eligibilitySnapshot),
      denialReason: this.toDenialReason(entity.denialReason),
      expiresAt: new Date(entity.expiresAt),
    });
  }

  private toEligibility(json: unknown): EligibilitySnapshot | null {
    if (json === null || json === undefined) return null;
    if (!isEligibilityNode(json)) throw new Error('invalid eligibility snapshot');
    return EligibilitySnapshot.freeze({
      personId: PersonId.of(json.personId),
      communityId: CommunityId.of(json.communityId),
      verdict: json.verdict,
      reference: json.reference,
      judgedAt: new Date(json.judgedAt),
    });
  }

  private toDenialReason(v: string | null): AuthorizationDenialReason | null {
    if (v === null || v === undefined) return null;
    return parseAuthorizationDenialReason(v);
  }

  toOrmFromDomain(auth: VoteAuthorization): VoteAuthorizationOrmEntity {
    const orm = new VoteAuthorizationOrmEntity();
    orm.id = auth.id.value;
    orm.proposalId = auth.proposalId.value;
    orm.voterAddress = auth.voterAddress.value;
    orm.status = auth.status;
    orm.denialReason = auth.denialReason;
    orm.expiresAt = auth.expiresAt;
    const e = auth.eligibility;
    orm.eligibilitySnapshot = e
      ? { personId: e.personId.value, communityId: e.communityId.value, verdict: e.verdict, reference: e.reference, judgedAt: e.judgedAt.toISOString() }
      : null;
    return orm;
  }
}
