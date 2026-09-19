import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request changing the recorded contact address (resets verified standing).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeEmailResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** Fresh address held by nobody else. */
  @ApiProperty({ example: 'grace@votachain.dev' })
  @IsEmail() newEmail: string;
}

/**
 * Request recording the observed email confirmation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class VerifyEmailResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** The recorded address the confirmation was observed for. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsEmail() email: string;
}
