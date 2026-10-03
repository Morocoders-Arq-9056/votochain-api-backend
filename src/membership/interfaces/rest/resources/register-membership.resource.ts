import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Membership registration carrying the pair plus the dwelling unit when known.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RegisterMembershipResource {
  /** Person joining (`per-` prefixed). */
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;

  /** Community joined (`com-` prefixed). */
  @ApiProperty({ example: 'com-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() communityId: string;

  /** Dwelling code within the community, when known. */
  @ApiProperty({ example: 'A-101', required: false })
  @IsString() @IsOptional() unitCode?: string;

  /** Community display name, carried for readability only. */
  @ApiProperty({ example: 'Villa El Salvador', required: false })
  @IsString() @IsOptional() communityName?: string;
}
