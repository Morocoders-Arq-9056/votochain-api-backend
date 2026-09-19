import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request rotating the local secret (ends the open session).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeSecretResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** New secret reference (never logged, never returned). */
  @ApiProperty({ example: 'new-secret-ref' })
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
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** Outside prover name (`auth0` in Sprint-01). */
  @ApiProperty({ example: 'auth0' })
  @IsString() @IsNotEmpty() provider: string;

  /** External id at the prover; required only for link. */
  @ApiProperty({ example: 'auth0|123456', required: false })
  @IsString() externalId: string;
}
