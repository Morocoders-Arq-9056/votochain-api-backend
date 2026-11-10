import { registerAs } from '@nestjs/config';

/**
 * IAM bounded context configuration.
 * Declares the classic-login password hasher selector consumed by the
 * PASSWORD_HASHER_SERVICE module factory (scrypt prod, fake tests).
 */
export default registerAs('iam', () => ({
  passwordHasher: process.env['PASSWORD_HASHER'] ?? 'scrypt',
}));
