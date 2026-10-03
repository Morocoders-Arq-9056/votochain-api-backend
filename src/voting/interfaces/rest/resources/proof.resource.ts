export class ProofResource {
  constructor(
    public readonly voteId: string,
    public readonly proposalId: string,
    public readonly choice: string,
    public readonly signature: { v: number; r: string; s: string },
    public readonly txHash: string | null,
    public readonly blockNumber: number | null,
    public readonly recovered: string,
    public readonly status: string,
  ) {}
}
