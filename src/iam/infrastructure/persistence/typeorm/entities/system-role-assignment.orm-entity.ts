import { Column } from "typeorm";
import { Entity } from "typeorm/decorator/entity/Entity.js";
import { PrimaryColumn } from "typeorm/decorator/columns/PrimaryColumn.js";
import { JoinColumn } from "typeorm/decorator/relations/JoinColumn.js";
import { ManyToOne } from "typeorm/decorator/relations/ManyToOne.js";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";
import { UserOrmEntity } from "./user.orm-entity.js";

@Entity('user_role_assignments', { schema: 'iam' })
export class SystemRoleAssignmentOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() role: string;
  @Column() grantedAt: Date;

  @ManyToOne(() => UserOrmEntity, (user) => user.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity;
}
