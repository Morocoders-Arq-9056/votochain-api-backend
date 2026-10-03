import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Recorded reason for delinquency/suspend/terminate transitions. The reason
 * is required input, judged present here; the transition itself is judged by
 * the Membership aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-02
 */
export class ReasonResource {
  /** Recorded reason for the transition. */
  @ApiProperty({ example: 'dues unpaid for two cycles' })
  @IsString() @IsNotEmpty() reason: string;
}
