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
import { CourtType } from '../../../../domain/value-object/court-type.vo';
import { BookingSlotSchema } from './booking-slot.schema';
import { CourtClusterSchema } from './court-cluster.schema';

@Entity('courts')
@Index('idx_courts_type', ['courtType'])
export class CourtSchema {
  @PrimaryGeneratedColumn({ name: 'court_id', type: 'int', unsigned: true })
  courtId!: number;

  @Column({ name: 'cluster_id', type: 'int', unsigned: true })
  clusterId!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'court_type', type: 'enum', enum: CourtType, default: CourtType.OUTDOOR })
  courtType!: CourtType;

  @Column({ type: 'varchar', length: 80, nullable: true })
  surface!: string | null;

  @Column({ name: 'opening_time', type: 'time', default: '06:00' })
  openingTime!: string;

  @Column({ name: 'closing_time', type: 'time', default: '22:00' })
  closingTime!: string;

  @Column({
    name: 'slot_duration_minutes',
    type: 'smallint',
    unsigned: true,
    default: 60,
  })
  slotDurationMinutes!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @ManyToOne(() => CourtClusterSchema, (cluster) => cluster.courts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'cluster_id' })
  cluster!: CourtClusterSchema;

  @OneToMany(() => BookingSlotSchema, (slot) => slot.court)
  slots!: BookingSlotSchema[];
}
