export class AuthenticatedUserResource {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly token: string,
  ) {}
}
