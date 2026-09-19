import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from './strategy/snake-naming.strategy.js';

/**
 * Builds the TypeORM configuration options based on the provided configuration service.
 * @param cfg The configuration service used to retrieve database settings.
 * @returns The TypeORM module options configured for the application.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export function buildTypeOrmOptions(cfg: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: cfg.getOrThrow<string>('database.host'),
    port: cfg.getOrThrow<number>('database.port'),
    username: cfg.getOrThrow<string>('database.username'),
    password: cfg.getOrThrow<string>('database.password'),
    database: cfg.getOrThrow<string>('database.name'),
    autoLoadEntities: true,
    synchronize: cfg.getOrThrow<boolean>('database.synchronize'),
    migrationsRun: false,
    migrations: ['dist/migrations/*.js'],
    namingStrategy: new SnakeNamingStrategy(),
    logging: cfg.getOrThrow<boolean>('database.logging'),
  };
}