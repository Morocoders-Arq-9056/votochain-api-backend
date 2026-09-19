import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SignUpResource {
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsNotEmpty() @IsEmail() email: string;
}