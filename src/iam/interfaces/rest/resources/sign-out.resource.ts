import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Sign-out request carrying the address whose open session closes.
 * Token-based sign-out (Authorization header) replaces this once JWT lands.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
export class SignOutResource {
  /** Contact address holding the identity. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsEmail() email: string;
}
