import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Community registration carrying the initial facts and the founding administrator.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class RegisterCommunityResource {
  /** Community name. */
  @ApiProperty({ example: 'Villa El Salvador' })
  @IsString() @IsNotEmpty() name: string;

  /** Community domicile. */
  @ApiProperty({ example: 'Lima, Peru' })
  @IsString() @IsNotEmpty() domicile: string;

  /** Community contact. */
  @ApiProperty({ example: 'contact@villa.example' })
  @IsString() @IsNotEmpty() contact: string;

  /** Founding administrator person id (`per-` prefixed). */
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() adminPersonId: string;
}
