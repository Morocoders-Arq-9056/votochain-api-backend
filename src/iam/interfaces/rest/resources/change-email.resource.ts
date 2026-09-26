import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Request changing the recorded contact address (resets verified standing).
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeEmailResource {
  /** Fresh address held by nobody else. */
  @ApiProperty({ example: 'grace@votachain.dev' })
  @IsEmail() newEmail: string;
}

/**
 * Request recording the observed email confirmation.
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class VerifyEmailResource {
  /** The recorded address the confirmation was observed for. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsEmail() email: string;
}
