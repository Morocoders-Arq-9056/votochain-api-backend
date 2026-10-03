export class VoteReceiptResource {
  constructor(
    public readonly voteId: string,
    public readonly proposalId: string,
    public readonly voterAddress: string,
    public readonly choice: string,
    public readonly status: string,
    public readonly txHash: string | null,
  ) {}
}
