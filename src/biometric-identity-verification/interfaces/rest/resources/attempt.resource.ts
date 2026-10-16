/** Verification attempt response. */
export class AttemptResource {
  constructor(
    public readonly id: string,
    public readonly personId: string,
    public readonly standing: string,
  ) {}
}
