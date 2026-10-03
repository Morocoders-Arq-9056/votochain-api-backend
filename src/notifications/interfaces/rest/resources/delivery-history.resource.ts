import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * One recorded attempt of a dispatch history, oldest first.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryAttemptResource {
  /** Moment the outcome was recorded (ISO string). */
  @ApiProperty({ example: '2026-09-28T12:00:00.000Z' })
  @IsString() @IsNotEmpty() at: string;

  /** Outcome: REQUESTED | REFUSED | CONFIRMED | FAILED. */
  @ApiProperty({ example: 'REQUESTED' })
  @IsString() @IsNotEmpty() outcome: string;

  /** Optional detail (refusal cause, failure cause). */
  @ApiProperty({ example: 'DUPLICATE', required: false })
  @IsOptional() @IsString() detail?: string;
}

/**
 * Full attempt history of one dispatch, for scrutiny consumers.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryHistoryResource {
  /** Dispatch identity (`dsp-` prefixed). */
  @ApiProperty({ example: 'dsp-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() dispatchId: string;

  /** Attempts, oldest first. */
  @ApiProperty({ type: [DeliveryAttemptResource] })
  @IsArray() attempts: DeliveryAttemptResource[];

  constructor(dispatchId: string, attempts: DeliveryAttemptResource[]) {
    this.dispatchId = dispatchId;
    this.attempts = attempts;
  }
}
