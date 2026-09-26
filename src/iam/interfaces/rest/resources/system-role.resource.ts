import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';

/**
 * Request granting a global technical system role.
 * The identity travels in the path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export class GrantRoleResource {
  /** Role to grant: ADMIN | USER. */
  @ApiProperty({ enum: ['ADMIN', 'USER'], example: 'ADMIN' })
  @IsIn(Object.values(SystemRole)) role: SystemRole;
}
