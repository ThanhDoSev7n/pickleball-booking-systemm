import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClusterStatus } from '../../../../domain/value-object/court-type.vo';
import { CourtSchema } from './court.schema';
import { UserSchema } from './user.schema';

@Entity('court_clusters')
@Index('idx_court_clusters_city', ['city'])
@Index('idx_court_clusters_status', ['status'])
export class CourtClusterSchema {
  @PrimaryGeneratedColumn({ name: 'cluster_id', type: 'int', unsigned: true })
  clusterId!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 80 })
  city!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'owner_id', type: 'int', unsigned: true })
  ownerId!: number;

  @Column({ type: 'enum', enum: ClusterStatus, default: ClusterStatus.PENDING })
  status!: ClusterStatus;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @ManyToOne(() => UserSchema, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserSchema;

  @OneToMany(() => CourtSchema, (court) => court.cluster)
  courts!: CourtSchema[];
}
