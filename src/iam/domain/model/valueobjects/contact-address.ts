/**
 * Value object representing a contact address.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class ContactAddress {
  /**
   * Creates a new ContactAddress instance.
   * @param email The email address of the contact.
   * @param verified Indicates whether the contact address has been verified.
   */
  private constructor(
    public readonly email: string,
    public readonly verified: boolean,
  ) {}

  /**
   * Creates a new ContactAddress instance with the provided email address.
   * @param email The email address of the contact.
   * @returns A new instance of ContactAddress with the provided email address and verified set to false.
   */
  static create(email: string): ContactAddress {
    return ContactAddress.of(email, false);
  }

  /**
   * Reconstructs a ContactAddress from a persisted email and verified flag.
   * @param email The email address of the contact.
   * @param verified Whether the contact address has been verified.
   * @returns A new instance of ContactAddress.
   */
  static of(email: string, verified: boolean): ContactAddress {
    if (!email?.trim()) throw new Error('email required');
    return new ContactAddress(email, verified);
  }

  /**
   * Changes the email address of the contact.
   * @param email The new email address of the contact.
   * @returns A new instance of ContactAddress with the updated email address and verified set to false.
   */
  change(email: string): ContactAddress {
    return ContactAddress.create(email);
  }

  /**
   * Verifies the contact address.
   * @returns A new instance of ContactAddress with the same email address and verified set to true.
   */
  verify(): ContactAddress {
    return new ContactAddress(this.email, true);
  }

  /**
   * Compares this ContactAddress instance with another for equality.
   * @param o The other ContactAddress instance to compare with.
   * @returns True if both have the same email and verified flag, otherwise false.
   */
  equals(o: ContactAddress): boolean { return this.email === o.email && this.verified === o.verified; }
}