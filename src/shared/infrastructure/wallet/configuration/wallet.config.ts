import { registerAs } from '@nestjs/config';

/**
 * Cryptographic Wallet Custody configuration (Sprint-03).
 * Prod composes `hd + hsm`; dev/test compose `test + memory`. The master
 * seed never lives in the application database (KMS/HSM in prod).
 */
export default registerAs('wallet', () => {
  const prod = (process.env['NODE_ENV'] ?? 'development') === 'production';
  return {
    kmsKeyId: process.env['WALLET_KMS_KEY_ID'] ?? '',
    hdNetwork: process.env['WALLET_HD_NETWORK'] ?? 'mainnet',
    chainId: parseInt(process.env['WALLET_CHAIN_ID'] ?? '80002', 10),
    derivationStrategy: process.env['WALLET_DERIVATION_STRATEGY'] ?? (prod ? 'hd' : 'test'),
    signingPolicy: process.env['WALLET_SIGNING_POLICY'] ?? (prod ? 'hsm' : 'memory'),
    masterSeed: process.env['WALLET_MASTER_SEED'] ?? '',
  };
});
