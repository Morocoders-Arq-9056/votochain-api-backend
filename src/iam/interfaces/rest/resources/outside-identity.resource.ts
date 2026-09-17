import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request rotating the local secret (ends the open session).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeSecretResource {
  /** Technical identity id (`usr-` prefixed). */
  @IsString() @IsNotEmpty() userId: string;

  /** New secret reference (never logged, never returned). */
  @IsString() @IsNotEmpty() newSecret: string;
}

/**
 * Request linking/unlinking the single agreed outside proof.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class OutsideIdentityResource {
  /** Technical identity id (`usr-` prefixed). */
  @IsString() @IsNotEmpty() userId: string;

  /** Outside prover name (`auth0` in Sprint-01). */
  @IsString() @IsNotEmpty() provider: string;

  /** External id at the prover; required only for link. */
  @IsString() externalId: string;
}
