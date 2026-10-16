/** Wallet response. No signing material ever leaves this context. */
export class WalletResource {
  constructor(
    public readonly id: string,
    public readonly personId: string,
    public readonly position: number,
    public readonly standing: string,
    public readonly openFor: string | null,
  ) {}
}
