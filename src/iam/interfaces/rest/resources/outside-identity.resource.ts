import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request rotating the local secret (ends the open session).
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeSecretResource {
  /** New secret reference (never logged, never returned). */
  @ApiProperty({ example: 'new-secret-ref' })
  @IsString() @IsNotEmpty() newSecret: string;
}

/**
 * Request linking the single agreed outside proof.
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class LinkOutsideIdentityResource {
  /** Outside prover name (`auth0` in Sprint-01). */
  @ApiProperty({ example: 'auth0' })
  @IsString() @IsNotEmpty() provider: string;

  /** External id at the prover. */
  @ApiProperty({ example: 'auth0|123456' })
  @IsString() @IsNotEmpty() externalId: string;
}
