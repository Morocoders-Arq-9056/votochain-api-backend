import { registerAs } from '@nestjs/config';

/**
 * Verification bounded context configuration.
 * Declares the OTP strategy selector and secrets consumed by the
 * CODE_COMPARE_SERVICE module factory (Sprint-01: hmac prod, fake tests).
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export default registerAs('verification', () => ({
  otp: {
    hasher: process.env['OTP_HASHER'] ?? 'hmac',
    hmacSecret: process.env['OTP_HMAC_SECRET'] ?? '',
  },
}));
