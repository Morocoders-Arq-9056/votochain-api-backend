/** Signing capability pull answer. */
export class CapabilityResource {
  constructor(
    public readonly maySign: boolean,
    public readonly walletId: string | null,
    public readonly position: number | null,
  ) {}
}
