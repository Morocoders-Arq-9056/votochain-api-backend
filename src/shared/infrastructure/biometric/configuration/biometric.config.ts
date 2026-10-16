import { registerAs } from '@nestjs/config';

/**
 * Biometric Identity Verification configuration (Sprint-03).
 * The match threshold is owned by this BC and never leaves it; the matcher
 * selector picks the vendor adapter behind the MATCHING_PORT.
 */
export default registerAs('biometric', () => ({
  freshnessMinutes: parseInt(process.env['FACE_FRESHNESS_MINUTES'] ?? '15', 10),
  matchThreshold: parseFloat(process.env['FACE_MATCH_THRESHOLD'] ?? '0.82'),
  matcher: process.env['FACE_MATCHER'] ?? 'vendor-a',
}));
