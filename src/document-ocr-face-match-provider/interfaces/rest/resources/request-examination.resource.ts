import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for a new examination: person + document reference. */
export class RequestExaminationResource {
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;

  @ApiProperty({ example: 'dni-12345678' })
  @IsString() @IsNotEmpty() documentRef: string;
}
