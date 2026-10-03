import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Eligibility judgment request (UC10 anchor). A command, not a query: every
 * judgment freezes a snapshot and registers the EligibilityJudgedEvent fact.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class JudgeEligibilityResource {
  /** Person the judgment is about (`per-` prefixed). */
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;

  /** Community the judgment is about (`com-` prefixed). */
  @ApiProperty({ example: 'com-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() communityId: string;
}
