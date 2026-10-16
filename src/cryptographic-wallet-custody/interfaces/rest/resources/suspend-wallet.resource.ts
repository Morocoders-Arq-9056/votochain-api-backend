import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Suspension request: recorded reason, free text. */
export class SuspendWalletResource {
  @ApiProperty({ example: 'key compromise suspected' })
  @IsString() @IsNotEmpty() reason: string;
}
