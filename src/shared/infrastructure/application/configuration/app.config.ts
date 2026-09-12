import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['SERVER_PORT'] ?? '3000', 10),
  prefix: process.env['API_PREFIX'] ?? 'api/v1',
  corsOrigins: (process.env['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}));