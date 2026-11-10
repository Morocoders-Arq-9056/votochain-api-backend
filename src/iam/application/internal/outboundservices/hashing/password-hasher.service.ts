/**
 * Outbound port for classic-login secret hashing. Implementations hash
 * plain secrets and compare them in constant time. The plain secret never
 * leaves the application service.
 */
export interface PasswordHasherService {
  hash(plain: string): Promise<string>;
  matches(plain: string, hash: string): Promise<boolean>;
}
export const PASSWORD_HASHER_SERVICE = Symbol('PASSWORD_HASHER_SERVICE');
