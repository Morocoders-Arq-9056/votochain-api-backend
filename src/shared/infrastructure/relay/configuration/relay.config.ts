import { registerAs } from '@nestjs/config';

/**
 * Blockchain Relay & Transaction Delivery configuration (Sprint-04).
 * `payerKey` is a secret — never logged. `redisUrl` backs the
 * `delivery.send` topic (BullMQ); unset keeps the in-process worker.
 */
export default registerAs('relay', () => ({
  amoyRpcUrl: process.env['AMOY_RPC_URL'] ?? '',
  payerKey: process.env['AMOY_PAYER_KEY'] ?? '',
  redisUrl: process.env['REDIS_URL'] ?? '',
  retryMax: parseInt(process.env['RELAY_MAX_RETRIES'] ?? '5', 10),
}));
