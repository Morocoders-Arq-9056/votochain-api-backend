import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: process.env['SWAGGER_TITLE'] ?? 'VotoChain API',
  description:
    process.env['SWAGGER_DESCRIPTION'] ??
    'VotoChain modular monolith REST API documentation.',
  version: process.env['SWAGGER_VERSION'] ?? '0.0.1',
  path: process.env['SWAGGER_PATH'] ?? 'api/docs',
}));