import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: ['.env.local', '.env'] });

const useCompiledArtifacts = process.env['TYPEORM_USE_COMPILED_ARTIFACTS'] === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'votachain',
  password: process.env['DB_PASSWORD'] ?? 'changeme',
  database: process.env['DB_NAME'] ?? 'votachain',
  synchronize: false,
  entities: useCompiledArtifacts
    ? ['dist/**/infrastructure/persistence/typeorm/entities/*.orm-entity.js']
    : ['src/**/infrastructure/persistence/typeorm/entities/*.orm-entity.ts'],
  migrations: useCompiledArtifacts ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
});
