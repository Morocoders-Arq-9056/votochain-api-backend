import { Injectable } from "@nestjs/common";
import { User } from "../../../../domain/model/aggregates/user.aggregate.js";
import { UserId } from "../../../../domain/model/valueobjects/user-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { parseAccessStanding } from "../../../../domain/model/valueobjects/access-standing.value-object.js";
import { UserOrmEntity } from "../entities/user.orm-entity.js";
import { parseSessionStanding } from "../../../../domain/model/valueobjects/session-standing.value-object.js";
import { ContactAddress } from "../../../../domain/model/valueobjects/contact-address.value-object.js";
import { parseSystemRole } from "../../../../domain/model/valueobjects/system-role.value-object.js";
import { SystemRoleAssignment } from "../../../../domain/model/entities/system-role-assignment.entity.js";
import { OutsideProverRef } from "../../../../domain/model/valueobjects/outside-prover-ref.value-object.js";
import { SystemRoleAssignmentOrmEntity } from "../entities/system-role-assignment.orm-entity.js";

@Injectable()
export class UserPersistenceAssembler {
  toDomainFromOrm(entity: UserOrmEntity): User {
    return User.rehydrate({
      id: UserId.of(entity.id),
      personId: PersonId.of(entity.personId),
      standing: parseAccessStanding(entity.standing),
      session: parseSessionStanding(entity.session),
      contact: ContactAddress.of(entity.email, entity.emailVerified),
      assignments: entity.assignments?.map((assignment) =>
        SystemRoleAssignment.rehydrate(assignment.id, parseSystemRole(assignment.role), assignment.grantedAt)) ?? [],
      outsideProver: entity.outsideProver ? OutsideProverRef.of(entity.outsideProver) : null,
    });
  }
  toOrmFromDomain(user: User): UserOrmEntity {
    const ormEntity = new UserOrmEntity();
    ormEntity.id = user.id.value;
    ormEntity.personId = user.personId.value;
    ormEntity.standing = user.standing;
    ormEntity.session = user.session;
    ormEntity.email = user.contact.email;
    ormEntity.emailVerified = user.contact.verified;
    ormEntity.assignments = user.roleAssignments.map((assignment) => {
      const row = new SystemRoleAssignmentOrmEntity();
      row.id = assignment.id;
      row.role = assignment.role;
      row.grantedAt = assignment.grantedAt;
      row.user = ormEntity;
      return row;
    });
    ormEntity.outsideProver = user.outsideProver ? user.outsideProver.provider : null;
    return ormEntity;
  }
}
