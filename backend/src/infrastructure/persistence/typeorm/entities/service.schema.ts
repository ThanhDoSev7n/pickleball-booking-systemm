import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('services')
export class ServiceSchema {
  @PrimaryGeneratedColumn({ name: 'service_id', type: 'int', unsigned: true }) serviceId!: number;
  @Column({ name: 'cluster_id', type: 'int', unsigned: true }) clusterId!: number;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 20 }) unit!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) price!: string;
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' }) updatedAt!: Date;
}
