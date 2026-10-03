import { Injectable } from "@nestjs/common";
import { Membership } from "../../../../domain/model/aggregates/membership.aggregate.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { parseCommunityRole } from "../../../../domain/model/valueobjects/community-role.value-object.js";
import { EligibilitySnapshot } from "../../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipId } from "../../../../domain/model/valueobjects/membership-id.value-object.js";
import { parseMembershipStatus } from "../../../../domain/model/valueobjects/membership-status.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { Unit } from "../../../../domain/model/valueobjects/unit.value-object.js";
import { MembershipOrmEntity } from "../entities/membership.orm-entity.js";

/**
 * Translates between the `Membership` domain aggregate and its
 * `MembershipOrmEntity` persistence shape. Domain → ORM reads everything off
 * the aggregate; ORM → domain parses every string through explicit parsers
 * (never `as`), so a corrupt row throws where the corruption happened.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipPersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * The last judgment re-anchors to the current row: verdict and reference
   * are frozen facts, while the moment falls back to the row timestamp.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: MembershipOrmEntity): Membership {
    const personId = PersonId.of(entity.personId);
    const communityId = CommunityId.of(entity.communityId);
    const status = parseMembershipStatus(entity.status);
    return Membership.rehydrate({
      id: MembershipId.of(entity.id),
      personId,
      communityId,
      status,
      role: parseCommunityRole(entity.role),
      unit: entity.unitCode ? Unit.of(entity.unitCode) : null,
      lastEligibility: entity.lastSnapshotRef
        ? EligibilitySnapshot.rehydrate(
            personId,
            communityId,
            status,
            entity.lastVerdict === 'ELIGIBLE',
            entity.lastSnapshotRef,
            entity.updatedAt ?? new Date(),
          )
        : null,
    });
  }

  /**
   * Renders the persistence row straight from the aggregate being saved.
   * Nothing enters the row that did not come from the domain object.
   * @param membership The aggregate to persist.
   */
  toOrmFromDomain(membership: Membership): MembershipOrmEntity {
    const ormEntity = new MembershipOrmEntity();
    ormEntity.id = membership.id.value;
    ormEntity.personId = membership.personId.value;
    ormEntity.communityId = membership.communityId.value;
    ormEntity.status = membership.status;
    ormEntity.role = membership.role.kind;
    ormEntity.unitCode = membership.unit?.code ?? null;
    const last = membership.lastEligibility;
    ormEntity.lastVerdict = last ? (last.verdict ? 'ELIGIBLE' : 'NOT_ELIGIBLE') : null;
    ormEntity.lastSnapshotRef = last?.reference ?? null;
    return ormEntity;
  }
}
