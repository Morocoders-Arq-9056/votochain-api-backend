import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';

/**
 * Session opening carrying the observed proof kind.
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class SignInResource {
  /** Observed proof kind: LOCAL | OUTSIDE. */
  @ApiProperty({ enum: ['LOCAL', 'OUTSIDE'], example: 'LOCAL' })
  @IsIn(Object.values(ProofKind)) proofKind: ProofKind;
}
