import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Sign request: the vote content to sign (owned by Voting). */
export class SignVoteContentResource {
  @ApiProperty({ example: 'vote:prop-1:0xabc:yes:nonce-1' })
  @IsString() @IsNotEmpty() contentRef: string;
}
