export class ProposalResource {
  constructor(
    public readonly proposalId: string,
    public readonly communityId: string,
    public readonly status: string,
    public readonly options: string[],
    public readonly quorum: { threshold: number; basis: string } | null,
    public readonly tally: { counts: Record<string, number>; turnout: number; quorumMet: boolean } | null,
  ) {}
}
