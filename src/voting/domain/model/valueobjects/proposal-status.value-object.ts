export const ProposalStatus = { DRAFT: 'DRAFT', OPEN: 'OPEN', CLOSED: 'CLOSED', TALLIED: 'TALLIED' } as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export function parseProposalStatus(v: string): ProposalStatus {
  if (!(Object.values(ProposalStatus) as string[]).includes(v)) throw new Error(`invalid proposal status: ${v}`);
  return v as ProposalStatus;
}
