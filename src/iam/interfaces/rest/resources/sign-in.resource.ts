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
  @IsString() @IsNotEmpty() userId: string;

  /** Observed proof kind: LOCAL | OUTSIDE. */
  @IsIn(Object.values(ProofKind)) proofKind: ProofKind;
}
