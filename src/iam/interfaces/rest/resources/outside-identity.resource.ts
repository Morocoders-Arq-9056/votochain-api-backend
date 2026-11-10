import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Request rotating the local secret (ends the open session).
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class ChangeSecretResource {
  /** New secret reference (never logged, never returned). */
  @ApiProperty({ example: 'S3gura-2026', writeOnly: true })
  @IsString() @IsNotEmpty()
  @MinLength(10) @MaxLength(16)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'secret must mix lower, upper and digit',
  })
  newSecret: string;
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
  @ApiProperty({ example: 'auth0', enum: ['auth0'] })
  @IsString() @IsNotEmpty() @IsIn(['auth0']) provider: string;

  /** External id at the prover. */
  @ApiProperty({ example: 'auth0|123456' })
  @IsString() @IsNotEmpty() externalId: string;
}
