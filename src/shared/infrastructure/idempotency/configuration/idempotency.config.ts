import { registerAs } from '@nestjs/config';

export default registerAs('idempotency', () => ({
  header: process.env['IDEMPOTENCY_HEADER'] ?? 'Idempotency-Key',
  ttlHours: parseInt(process.env['IDEMPOTENCY_TTL_HOURS'] ?? '24', 10),
}));