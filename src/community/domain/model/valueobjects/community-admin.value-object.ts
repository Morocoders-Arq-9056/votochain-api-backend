import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";

/**
 * Value object representing one entrusted administrator: the person plus
 * the moment of entrustment. Distinct from holding a part within the
 * association and from any system-wide grant.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityAdmin {
  /**
   * Creates a new CommunityAdmin instance.
   * @param personId The entrusted person, held as identity reference only.
   * @param entrustedAt The moment of entrustment.
   */
  private constructor(
    public readonly personId: PersonId,
    public readonly entrustedAt: Date,
  ) {}

  /**
   * Entrusts a person as administrator now.
   * @param personId The person to entrust.
   * @returns A new instance of CommunityAdmin.
   */
  static appoint(personId: PersonId): CommunityAdmin {
    if (!personId) throw new Error('personId required');
    return new CommunityAdmin(personId, new Date());
  }

  /**
   * Reconstructs a CommunityAdmin from a persisted person and moment.
   * @param personId The entrusted person.
   * @param entrustedAt The moment of entrustment.
   * @returns A new instance of CommunityAdmin.
   */
  static of(personId: PersonId, entrustedAt: Date): CommunityAdmin {
    if (!personId) throw new Error('personId required');
    if (!(entrustedAt instanceof Date)) throw new Error('entrustedAt required');
    return new CommunityAdmin(personId, entrustedAt);
  }

  /**
   * Compares this CommunityAdmin instance with another for equality.
   * @param o The other CommunityAdmin instance to compare with.
   * @returns True if both are entrusted to the same person, otherwise false.
   */
  equals(o: CommunityAdmin): boolean { return this.personId.equals(o.personId); }
}
