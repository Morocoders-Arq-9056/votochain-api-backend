import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';

/**
 * Classic-login sign-in carrying what the caller knows: address + secret.
 * `proofKind` stays optional for the linked-identity (Google) button:
 * LOCAL (default) requires `password`; OUTSIDE skips it and judges the
 * linked outside proof instead. Every LOCAL rejection collapses to 401
 * invalid credentials.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-11-10
 */
export class SignInResource {
  /** Contact address holding the identity. */
  @ApiProperty({ example: 'ada@votachain.dev' })
  @IsEmail() email: string;

  /** Plain secret for LOCAL (never logged, never returned). */
  @ApiProperty({ example: 'S3gura-2026', writeOnly: true, required: false })
  @IsOptional() @MinLength(1) @MaxLength(128) password?: string;

  /** Observed proof kind: LOCAL (default) | OUTSIDE. */
  @ApiProperty({ enum: ['LOCAL', 'OUTSIDE'], example: 'LOCAL', required: false })
  @IsOptional() @IsIn(Object.values(ProofKind)) proofKind?: ProofKind;
}
