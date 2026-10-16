/** Fresh-verified answer consumed by Voting (R3). */
export class VerifiedNowResource {
  constructor(
    public readonly verifiedNow: boolean,
    public readonly reason: string | null,
  ) {}
}
