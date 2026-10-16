/** Examination response carrying judgments only — never evidence. */
export class ExaminationResource {
  constructor(
    public readonly id: string,
    public readonly personId: string,
    public readonly documentRef: string,
    public readonly standing: string,
    public readonly verdict: string | null,
    public readonly consumed: boolean,
  ) {}
}
