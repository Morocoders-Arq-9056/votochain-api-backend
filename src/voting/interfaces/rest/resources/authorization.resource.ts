export class AuthorizationResource {
  constructor(
    public readonly authorizationId: string,
    public readonly proposalId: string,
    public readonly voterAddress: string,
    public readonly status: string,
    public readonly expiresAt: Date,
  ) {}
}
