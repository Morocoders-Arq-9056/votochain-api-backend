import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import { ProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';

/**
 * Sign-in request carrying what the caller actually knows: the address
 * plus the observed proof kind. The server resolves the address into the
 * technical identity; callers never present a user id they cannot know.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
export class SignInResource {
  /** Contact address holding the identity. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsEmail() email: string;

  /** Observed proof kind: LOCAL | OUTSIDE. */
  @ApiProperty({ enum: ['LOCAL', 'OUTSIDE'], example: 'LOCAL' })
  @IsIn(Object.values(ProofKind)) proofKind: ProofKind;
}
