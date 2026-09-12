import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const cfg = app.get(ConfigService);
  const title = cfg.get<string>('swagger.title', 'VotoChain API');
  const description = cfg.get<string>('swagger.description', '');
  const version = cfg.get<string>('swagger.version', '0.0.1');
  const path = cfg.get<string>('swagger.path', 'api/docs');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(title)
      .setDescription(description)
      .setVersion(version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build(),
  );
  SwaggerModule.setup(path, app, document);
}