import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '../../../../domain/value-object/booking-status.vo';
import { BookingSlotSchema } from './booking-slot.schema';
import { CourtSchema } from './court.schema';
import { CourtClusterSchema } from './court-cluster.schema';
import { UserSchema } from './user.schema';

export const DEFAULT_CURRENCY = 'VND';

@Entity('bookings')
@Index('idx_bookings_user_status', ['userId', 'status'])
@Index('idx_bookings_court_start', ['courtId', 'startTime'])
@Index('idx_bookings_cluster_start', ['clusterId', 'startTime'])
@Index('idx_bookings_status', ['status'])
@Unique('uk_bookings_booking_code', ['bookingCode'])
@Unique('uk_bookings_qr_code', ['qrCode'])
export class BookingSchema {
  @PrimaryGeneratedColumn({ name: 'booking_id', type: 'int', unsigned: true })
  bookingId!: number;

  @Column({ name: 'booking_code', type: 'varchar', length: 20 })
  bookingCode!: string;

  @Column({ name: 'qr_code', type: 'varchar', length: 64 })
  qrCode!: string;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @Column({ name: 'court_id', type: 'int', unsigned: true })
  courtId!: number;

  @Column({ name: 'cluster_id', type: 'int', unsigned: true })
  clusterId!: number;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime!: Date;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  /** Dien boi Pricing Engine (Thanh vien 2) - co the null luc vua confirm. */
  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount!: string | null;

  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 255, nullable: true })
  cancelReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @ManyToOne(() => UserSchema, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserSchema;

  @ManyToOne(() => CourtSchema, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'court_id' })
  court!: CourtSchema;

  @ManyToOne(() => CourtClusterSchema, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster!: CourtClusterSchema;

  @OneToMany(() => BookingSlotSchema, (slot) => slot.booking)
  slots!: BookingSlotSchema[];
}
