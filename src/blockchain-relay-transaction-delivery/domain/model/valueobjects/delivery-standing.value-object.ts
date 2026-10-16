export const DeliveryStanding = {
  ACCEPTED: 'ACCEPTED',
  ORDERED: 'ORDERED',
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  RETRIED: 'RETRIED',
  ABANDONED: 'ABANDONED',
} as const;
export type DeliveryStanding = (typeof DeliveryStanding)[keyof typeof DeliveryStanding];

export function parseDeliveryStanding(v: string): DeliveryStanding {
  if (!(Object.values(DeliveryStanding) as string[]).includes(v)) throw new Error(`invalid delivery standing: ${v}`);
  return v as DeliveryStanding;
}
