import { Injectable } from "@nestjs/common";
import { User } from "../../../../domain/model/aggregates/user.aggregate.js";
import { UserId } from "../../../../domain/model/valueobjects/user-id.value-object.js";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { parseAccessStanding } from "../../../../domain/model/valueobjects/access-standing.value-object.js";
import { UserOrmEntity } from "../entities/user.orm-entity.js";
import { parseSessionStanding } from "../../../../domain/model/valueobjects/session-standing.value-object.js";
import { ContactAddress } from "../../../../domain/model/valueobjects/contact-address.value-object.js";
import { parseSystemRole } from "../../../../domain/model/valueobjects/system-role.value-object.js";
import { OutsideProverRef } from "../../../../domain/model/valueobjects/outside-prover-ref.value-object.js";

/**
 * Translates between the `User` domain aggregate and its `UserOrmEntity`
 * persistence shape. Domain → ORM reads everything off the aggregate;
 * ORM → domain parses every string through explicit parsers (never `as`),
 * so a corrupt row throws where the corruption happened.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class UserPersistenceAssembler {
  /**
   * Rebuilds the domain aggregate from a stored row without raising events.
   * @param entity The persisted row to translate.
   */
  toDomainFromOrm(entity: UserOrmEntity): User {
    return User.rehydrate({
      id: UserId.of(entity.id),
      personId: PersonId.of(entity.personId),
      standing: parseAccessStanding(entity.standing),
      session: parseSessionStanding(entity.session),
      contact: ContactAddress.of(entity.email, entity.emailVerified),
      roles: (entity.roles ?? []).map((r) => parseSystemRole(r)),
      outsideProver: entity.outsideProver ? OutsideProverRef.of(entity.outsideProver) : null,
    });
  }

  /**
   * Renders the persistence row straight from the aggregate being saved.
   * Nothing enters the row that did not come from the domain object.
   * @param user The aggregate to persist.
   */
  toOrmFromDomain(user: User): UserOrmEntity {
    const ormEntity = new UserOrmEntity();
    ormEntity.id = user.id.value;
    ormEntity.personId = user.personId.value;
    ormEntity.standing = user.standing;
    ormEntity.session = user.session;
    ormEntity.email = user.contact.email;
    ormEntity.emailVerified = user.contact.verified;
    ormEntity.roles = [...user.roles];
    ormEntity.outsideProver = user.outsideProver ? user.outsideProver.provider : null;
    return ormEntity;
  }
}
