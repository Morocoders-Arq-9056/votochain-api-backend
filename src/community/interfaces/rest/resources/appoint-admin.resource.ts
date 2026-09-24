import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Administrator appointment carrying the entrusted person.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class AppointAdminResource {
  /** Entrusted person id (`per-` prefixed). */
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;
}
