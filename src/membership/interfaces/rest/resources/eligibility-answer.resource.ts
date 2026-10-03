import { ApiProperty } from '@nestjs/swagger';

/**
 * Frozen eligibility judgment answer (UC10 anchor). Absence answers
 * NOT_ELIGIBLE — never 404 — with the frozen snapshot reference.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-02
 */
export class EligibilityAnswerResource {
  /** Frozen judgment verdict. */
  @ApiProperty({ example: true })
  readonly eligible: boolean;

  /** Stable reference the consumer freezes a copy of. */
  @ApiProperty({ example: 'snap-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  readonly snapshotRef: string;

  /** Standing observed at the moment of judgment. */
  @ApiProperty({ example: 'ACTIVE' })
  readonly standingObserved: string;

  constructor(eligible: boolean, snapshotRef: string, standingObserved: string) {
    this.eligible = eligible;
    this.snapshotRef = snapshotRef;
    this.standingObserved = standingObserved;
  }
}
