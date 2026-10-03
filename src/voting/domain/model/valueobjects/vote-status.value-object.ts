export const VoteStatus = { SIGNED: 'SIGNED', QUEUED: 'QUEUED', SENT: 'SENT', CONFIRMED: 'CONFIRMED', FAILED: 'FAILED' } as const;
export type VoteStatus = (typeof VoteStatus)[keyof typeof VoteStatus];

export function parseVoteStatus(v: string): VoteStatus {
  if (!(Object.values(VoteStatus) as string[]).includes(v)) throw new Error(`invalid vote status: ${v}`);
  return v as VoteStatus;
}
