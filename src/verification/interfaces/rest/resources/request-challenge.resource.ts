import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Purpose } from '../../../domain/model/valueobjects/purpose.value-object.js';

/**
 * Challenge request carrying the person and the closed proof purpose.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class RequestChallengeResource {
  /** Referenced person id (`per-` prefixed). */
  @ApiProperty({ example: 'per-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() personId: string;

  /** Proof purpose: login | email-verification | password-reset. */
  @ApiProperty({ enum: ['login', 'email-verification', 'password-reset'], example: 'email-verification' })
  @IsIn(Object.values(Purpose)) purpose: Purpose;
}
