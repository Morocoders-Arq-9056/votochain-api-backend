import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Community settings update carrying the new facts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class UpdateCommunitySettingsResource {
  /** Community name. */
  @ApiProperty({ example: 'Villa El Salvador' })
  @IsString() @IsNotEmpty() name: string;

  /** Community domicile. */
  @ApiProperty({ example: 'Lima, Peru' })
  @IsString() @IsNotEmpty() domicile: string;

  /** Community contact. */
  @ApiProperty({ example: 'contact@villa.example' })
  @IsString() @IsNotEmpty() contact: string;
}
