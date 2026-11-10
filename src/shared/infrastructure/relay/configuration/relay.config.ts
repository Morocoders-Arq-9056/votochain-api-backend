import { registerAs } from '@nestjs/config';

/**
 * Blockchain Relay & Transaction Delivery configuration (Sprint-04).
 * `payerKey` is a secret — never logged. `redisUrl` backs the
 * `delivery.send` topic (BullMQ); unset keeps the in-process worker.
 */
export default registerAs('relay', () => ({
  amoyRpcUrl: process.env['AMOY_RPC_URL'] ?? '',
  payerKey: process.env['AMOY_PAYER_KEY'] ?? '',
  ledgerAddress: process.env['AMOY_LEDGER_ADDRESS'] ?? '',
  payerAddress: process.env['AMOY_PAYER_ADDRESS'] ?? '',
  chainId: parseInt(process.env['AMOY_CHAIN_ID'] ?? '80002', 10),
  confirmTimeoutMs: parseInt(process.env['AMOY_CONFIRM_TIMEOUT_MS'] ?? '60000', 10),
  redisUrl: process.env['REDIS_URL'] ?? '',
  queueDriver: process.env['QUEUE_DRIVER'] ?? 'in-process',
  ledgerNetwork: process.env['LEDGER_NETWORK'] ?? 'amoy',
  retryMax: parseInt(process.env['RELAY_MAX_RETRIES'] ?? '5', 10),
}));
