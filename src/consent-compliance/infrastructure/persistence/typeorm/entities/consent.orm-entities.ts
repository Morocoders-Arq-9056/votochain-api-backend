import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

@Entity('consents', { schema: 'consent' })
export class ConsentOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'person_id' })
  personId!: string;

  @Column()
  scope!: string;

  @Column()
  standing!: string;

  @Column({ name: 'policy_version' })
  policyVersion!: string;

  @Column({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;
}

@Entity('requests', { schema: 'consent' })
export class ErasureRequestOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'person_id' })
  personId!: string;

  @Column()
  standing!: string;

  @Column('jsonb')
  confirmations!: { asked: string[]; confirmed: string[] };
}

@Entity('policies', { schema: 'consent' })
export class RetentionPolicyOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  category!: string;

  @Column('jsonb')
  terms!: Record<string, unknown>;

  @Column({ nullable: true })
  supersedes!: string | null;
}
