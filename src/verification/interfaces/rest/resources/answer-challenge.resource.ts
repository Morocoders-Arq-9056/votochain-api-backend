import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Challenge answer carrying the presented code. Judged once per attempt,
 * never kept readable, never returned.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class AnswerChallengeResource {
  /** Presented one-time code (starting proposal: 6 digits). */
  @ApiProperty({ example: '482913' })
  @IsString() @IsNotEmpty() code: string;
}
