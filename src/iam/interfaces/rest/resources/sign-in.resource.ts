import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';

/**
 * Sign-in request carrying the identity and the observed proof kind.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class SignInResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** Observed proof kind: LOCAL | OUTSIDE. */
  @ApiProperty({ enum: ['LOCAL', 'OUTSIDE'], example: 'LOCAL' })
  @IsIn(Object.values(ProofKind)) proofKind: ProofKind;
}
