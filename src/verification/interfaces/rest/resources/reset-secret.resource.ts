import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Recovery reset carrying the new secret for a confirmed password-reset
 * challenge. Judged once per attempt, never kept readable, never returned.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-11-10
 */
export class ResetSecretResource {
  /** New secret reference (never logged, never returned). */
  @ApiProperty({ example: 'new-secret-ref' })
  @IsString() @IsNotEmpty() newSecret: string;
}
