/** Closed set of wallet standings. `RETIRED` is terminal. */
export const WalletStanding = {
  PROVISIONED: 'PROVISIONED',
  SIGNING_OPEN: 'SIGNING_OPEN',
  ROTATED: 'ROTATED',
  SUSPENDED: 'SUSPENDED',
  RETIRED: 'RETIRED',
} as const;
export type WalletStanding = (typeof WalletStanding)[keyof typeof WalletStanding];

export function parseWalletStanding(v: string): WalletStanding {
  if (!(Object.values(WalletStanding) as string[]).includes(v))
    throw new Error(`invalid wallet standing: ${v}`);
  return v as WalletStanding;
}
