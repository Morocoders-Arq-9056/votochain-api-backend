import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Standing transition request. The standing is the desired state, not an
 * action: the server still judges the transition and refuses illegal ones.
 * A reason is required when suspending or archiving.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
export class StandingUpdateResource {
  /** Desired standing: ACTIVE | SUSPENDED | ARCHIVED. */
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'], example: 'SUSPENDED' })
  @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED']) standing: string;

  /** Recorded reason, required for SUSPENDED and ARCHIVED. */
  @ApiProperty({ example: 'electoral roll under review', required: false })
  @IsOptional() @IsString() @IsNotEmpty() reason?: string;
}
