import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Recorded reason for suspension and archival transitions.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class ReasonResource {
  /** The recorded reason. */
  @ApiProperty({ example: 'electoral roll under review' })
  @IsString() @IsNotEmpty() reason: string;
}
