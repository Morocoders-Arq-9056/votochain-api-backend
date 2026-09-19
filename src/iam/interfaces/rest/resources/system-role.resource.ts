import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { SystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';

/**
 * Request granting or revoking a global technical system role.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class SystemRoleResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** Role to grant/revoke: ADMIN | USER. */
  @ApiProperty({ enum: ['ADMIN', 'USER'], example: 'ADMIN' })
  @IsIn(Object.values(SystemRole)) role: SystemRole;
}

/**
 * Request suspending access with a recorded reason (admin decision).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class SuspendAccessResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;

  /** Recorded suspension reason. */
  @ApiProperty({ example: 'abuse' })
  @IsString() @IsNotEmpty() reason: string;
}

/**
 * Request carrying only the acting identity id.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class UserIdResource {
  /** Technical identity id (`usr-` prefixed). */
  @ApiProperty({ example: 'usr-3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsString() @IsNotEmpty() userId: string;
}
