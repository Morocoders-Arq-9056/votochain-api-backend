import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Enrollment request: the person whose reference is established. */
export class EnrollBiometricResource {
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;
}
