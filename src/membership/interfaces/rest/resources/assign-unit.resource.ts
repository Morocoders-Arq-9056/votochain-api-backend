import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Dwelling-unit assignment.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AssignUnitResource {
  /** Dwelling code within the community. */
  @ApiProperty({ example: 'A-101' })
  @IsString() @IsNotEmpty() unitCode: string;

  /** Community display name, carried for readability only. */
  @ApiProperty({ example: 'Villa El Salvador', required: false })
  @IsString() @IsOptional() communityName?: string;
}
