export class TallyResource {
  constructor(
    public readonly proposalId: string,
    public readonly counts: Record<string, number>,
    public readonly turnout: number,
    public readonly quorumMet: boolean,
  ) {}
}
