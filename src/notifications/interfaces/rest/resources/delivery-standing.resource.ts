import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { DispatchStanding } from '../../../domain/model/valueobjects/dispatch-standing.value-object.js';

/**
 * Delivery-standing answer: current standing plus attempt count and the
 * refusal cause when refused. Mutates nothing, produces no facts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryStandingResource {
  /** Dispatch identity (`dsp-` prefixed). */
  @ApiProperty({ example: 'dsp-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() dispatchId: string;

  /** Current standing: REQUESTED | REFUSED | CONFIRMED | FAILED. */
  @ApiProperty({ enum: Object.values(DispatchStanding), example: 'REQUESTED' })
  @IsIn(Object.values(DispatchStanding)) standing: string;

  /** How many attempts the history holds. */
  @ApiProperty({ example: 1 })
  @IsInt() @Min(0) attempts: number;

  /** Refusal cause when REFUSED, null otherwise. */
  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional() @IsString() refusal: string | null;

  constructor(dispatchId: string, standing: string, attempts: number, refusal: string | null) {
    this.dispatchId = dispatchId;
    this.standing = standing;
    this.attempts = attempts;
    this.refusal = refusal;
  }
}
