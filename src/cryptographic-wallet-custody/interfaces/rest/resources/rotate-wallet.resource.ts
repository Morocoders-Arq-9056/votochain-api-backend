import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Rotation request: the fresh derivation position. */
export class RotateWalletResource {
  @ApiProperty({ example: 1 })
  @IsInt() @Min(0) newPosition: number;
}
