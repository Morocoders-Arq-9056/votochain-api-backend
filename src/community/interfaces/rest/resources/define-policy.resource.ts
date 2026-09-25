import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPositive, IsString } from 'class-validator';

/**
 * Voting policy definition carrying the new participation rule.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class DefinePolicyResource {
  /** Quorum threshold: how much participation is enough. */
  @ApiProperty({ example: 51 })
  @IsPositive() threshold: number;

  /** Quorum basis: enough of what (members, units, weighted). */
  @ApiProperty({ example: 'members' })
  @IsString() @IsNotEmpty() basis: string;

  /** Majority rule: how a winner is recognized. */
  @ApiProperty({ example: 'simple-majority' })
  @IsString() @IsNotEmpty() majorityRule: string;
}
