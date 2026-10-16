/** One scrutiny fact of a capability. */
export class AdminshipEntryResource {
  constructor(
    public readonly eventName: string,
    public readonly occurredAt: Date,
  ) {}
}
