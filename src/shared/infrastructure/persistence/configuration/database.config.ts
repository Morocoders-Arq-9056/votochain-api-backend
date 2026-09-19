import { registerAs } from '@nestjs/config';

/**
 * Database configuration.
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export default registerAs('database', () => ({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'votachain',
  password: process.env['DB_PASSWORD'] ?? 'changeme',
  name: process.env['DB_NAME'] ?? 'votachain',
  logging: (process.env['DB_LOGGING'] ?? 'false') === 'true',
  synchronize: (process.env['DB_SYNCHRONIZE'] ?? 'false') === 'true',
}));