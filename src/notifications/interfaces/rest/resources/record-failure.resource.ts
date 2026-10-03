import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Executor-observed failure cause carried by the UC3 webhook.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RecordFailureResource {
  /** Observed failure cause (bounce, timeout, rejected). */
  @ApiProperty({ example: 'bounce' })
  @IsString() @IsNotEmpty() reason: string;
}
