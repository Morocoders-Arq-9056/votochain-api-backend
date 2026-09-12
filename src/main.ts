import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './shared/infrastructure/documentation/openapi/configuration/swagger.setup.js';
import { GlobalExceptionFilter } from './shared/interfaces/rest/filters/global-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);

  app.setGlobalPrefix(cfg.get<string>('app.prefix', 'api/v1')!);
  app.enableCors({
    origin: cfg.get<string[]>('app.corsOrigins', []) as string[],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  setupSwagger(app);

  await app.listen(cfg.get<number>('app.port', 3000)!);
}
await bootstrap();