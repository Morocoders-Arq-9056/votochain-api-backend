import { Entity } from "typeorm/decorator/entity/Entity.js";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";
import { PrimaryColumn } from "typeorm/decorator/columns/PrimaryColumn.js";
import { Column } from "typeorm";
import { OneToMany } from "typeorm/decorator/relations/OneToMany.js";
import { SystemRoleAssignmentOrmEntity } from "./system-role-assignment.orm-entity.js";

@Entity('users', { schema: 'iam' })
export class UserOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column({unique: true}) personId: string;
  @Column() standing: string
  @Column() session: string;
  @Column({ unique: true }) email: string
  @Column() emailVerified: boolean;
  @OneToMany(() => SystemRoleAssignmentOrmEntity, (assignment) => assignment.user, { cascade: true, orphanedRowAction: 'delete' })
  assignments: SystemRoleAssignmentOrmEntity[];
  @Column({ nullable: true }) outsideProver: string | null;
}