import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class SignUpResource {
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsNotEmpty() @IsEmail() email: string;

  /** Plain secret accepted under policy (never logged, never returned). */
  @ApiProperty({ example: 'S3gura-2026', writeOnly: true })
  @IsNotEmpty()
  @MinLength(10) @MaxLength(16)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'secret must mix lower, upper and digit',
  })
  password: string;
}
