/** Reference profile response. */
export class ProfileResource {
  constructor(
    public readonly id: string,
    public readonly personId: string,
    public readonly standing: string,
  ) {}
}
