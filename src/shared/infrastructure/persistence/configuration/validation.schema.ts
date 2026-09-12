import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  SERVER_PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  JWT_SECRET: Joi.string().min(32).required(),
  OTP_HMAC_SECRET: Joi.string().required(),
  SWAGGER_TITLE: Joi.string().default('VotoChain API'),
  SWAGGER_DESCRIPTION: Joi.string().allow('').default(''),
  SWAGGER_VERSION: Joi.string().default('0.0.1'),
  SWAGGER_PATH: Joi.string().default('api/docs'),
  IDEMPOTENCY_HEADER: Joi.string().default('Idempotency-Key'),
  IDEMPOTENCY_TTL_HOURS: Joi.number().default(24),
}).unknown(true);