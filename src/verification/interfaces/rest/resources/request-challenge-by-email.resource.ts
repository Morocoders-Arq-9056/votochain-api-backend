import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Purpose } from '../../../domain/model/valueobjects/purpose.value-object.js';

/**
 * Challenge request by contact address for pre-login flows (recovery).
 * The server resolves the address into its person; unknown addresses 404.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-11-09
 */
export class RequestChallengeByEmailResource {
  /** Contact address held by the person. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsString() @IsNotEmpty() @IsEmail() email: string;

  /** Proof purpose: login | email-verification | password-reset. */
  @ApiProperty({ enum: ['login', 'email-verification', 'password-reset'], example: 'password-reset' })
  @IsIn(Object.values(Purpose)) purpose: Purpose;
}
