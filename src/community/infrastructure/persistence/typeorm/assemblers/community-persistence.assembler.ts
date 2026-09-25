import { Injectable } from "@nestjs/common";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { Community } from "../../../../domain/model/aggregates/community.aggregate.js";
import { CommunityAdmin } from "../../../../domain/model/valueobjects/community-admin.value-object.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { CommunitySettings } from "../../../../domain/model/valueobjects/community-settings.value-object.js";
import { parseCommunityStanding } from "../../../../domain/model/valueobjects/community-standing.value-object.js";
import { VotingPolicy } from "../../../../domain/model/valueobjects/voting-policy.value-object.js";
import { CommunityOrmEntity } from "../entities/community.orm-entity.js";

/**
 * Raw policy node as stored in the `policy` JSONB column: the current head
 * with its superseded predecessors nested inline.
 */
interface PolicyNode {
  threshold: unknown;
  basis: unknown;
  majorityRule: unknown;
  supersedes: unknown;
}

/**
 * Translates between the `Community` domain aggregate and its
 * `CommunityOrmEntity` persistence shape. Domain → ORM reads everything off
 * the aggregate; ORM → domain parses every string through explicit parsers
 * (never `as`), so a corrupt row throws where the corruption happened.
 * The policy supersede chain nests inline in the JSONB column: loading
 * rebuilds the full link, saving serializes it back, and no version is
 * ever overwritten.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityPersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: CommunityOrmEntity): Community {
    return Community.rehydrate({
      id: CommunityId.of(entity.id),
      standing: parseCommunityStanding(entity.standing),
      settings: CommunitySettings.create({ name: entity.name, domicile: entity.domicile, contact: entity.contact }),
      policy: this.toPolicy(entity.policy),
      admins: (entity.admins ?? []).map((a) =>
        CommunityAdmin.of(PersonId.of(a.personId), new Date(a.entrustedAt))),
    });
  }

  /**
   * Rebuilds a voting policy version with its superseded predecessors linked.
   * @param json The stored node or null when no policy was ever defined.
   */
  private toPolicy(json: unknown): VotingPolicy | null {
    if (json === null || json === undefined) return null;
    if (typeof json !== 'object') throw new Error('invalid policy node');
    const node = json as PolicyNode;
    if (typeof node.threshold !== 'number' || typeof node.basis !== 'string' || typeof node.majorityRule !== 'string')
      throw new Error('invalid policy node');
    return VotingPolicy.define({
      threshold: node.threshold,
      basis: node.basis,
      majorityRule: node.majorityRule,
      supersedes: this.toPolicy(node.supersedes ?? null),
    });
  }

  /**
   * Renders the persistence row straight from the aggregate being saved.
   * Nothing enters the row that did not come from the domain object.
   * @param community The aggregate to persist.
   */
  toOrmFromDomain(community: Community): CommunityOrmEntity {
    const ormEntity = new CommunityOrmEntity();
    ormEntity.id = community.id.value;
    ormEntity.standing = community.standing;
    ormEntity.name = community.settings.name;
    ormEntity.domicile = community.settings.domicile;
    ormEntity.contact = community.settings.contact;
    ormEntity.policy = this.toJson(community.policy);
    ormEntity.admins = community.admins.map((a) => ({
      personId: a.personId.value,
      entrustedAt: a.entrustedAt.toISOString(),
    }));
    return ormEntity;
  }

  /**
   * Serializes a policy version with its superseded predecessors nested inline.
   * @param policy The current head or null when undefined.
   */
  private toJson(policy: VotingPolicy | null): CommunityOrmEntity['policy'] {
    if (!policy) return null;
    return {
      threshold: policy.threshold,
      basis: policy.basis,
      majorityRule: policy.majorityRule,
      supersedes: this.toJson(policy.supersedes),
    };
  }
}
