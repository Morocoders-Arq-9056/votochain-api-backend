import { AddressMalformedError } from "../../exceptions/address-malformed.error.js";

/**
 * Email shape of a delivery destination.
 *
 * Email-only MVP: the address carries no person identity, only where the
 * rendered template goes. Malformed addresses are rejected at construction.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryAddress {

  /**
   * Creates a new DeliveryAddress instance.
   *
   * @param value The email address value.
   */
  private constructor(public readonly value: string) {}

  /**
   * Creates a DeliveryAddress instance from a given string value.
   * @param v The raw address string to validate as email shape.
   * @returns A new instance of DeliveryAddress with the provided value.
   * @throws AddressMalformedError When the value has no email shape.
   */
  static of(v: string): DeliveryAddress {
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
      throw new AddressMalformedError(`malformed delivery address: ${v}`);
    return new DeliveryAddress(v.trim());
  }

  /**
   * Compares the current DeliveryAddress instance with another one for equality.
   * @param o The other DeliveryAddress instance to compare with.
   * @returns True when both instances carry the same value.
   */
  equals(o: DeliveryAddress): boolean { return this.value === o.value; }
}
