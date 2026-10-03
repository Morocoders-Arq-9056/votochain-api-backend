import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CommunityRoleKind } from "../../../domain/model/valueobjects/community-role.value-object.js";

/**
 * Community-role assignment. Requires an ACTIVE standing (judged by the
 * aggregate, mapped to 409).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AssignRoleResource {
  /** Role kind: PRESIDENT | BOARD_MEMBER | OWNER. */
  @ApiProperty({ example: 'BOARD_MEMBER', enum: Object.values(CommunityRoleKind) })
  @IsString() @IsNotEmpty() @IsIn(Object.values(CommunityRoleKind)) role: string;
}
