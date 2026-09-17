import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request changing the recorded contact address (resets verified standing).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeEmailResource {
  /** Technical identity id (`usr-` prefixed). */
  @IsString() @IsNotEmpty() userId: string;

  /** Fresh address held by nobody else. */
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
  @IsString() @IsNotEmpty() userId: string;

  /** The recorded address the confirmation was observed for. */
  @IsEmail() email: string;
}
