import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SlotStatus } from '../../../../domain/value-object/slot-status.vo';
import { BookingSchema } from './booking.schema';
import { CourtSchema } from './court.schema';
import { UserSchema } from './user.schema';

/**
 * Bang NONG NHAT cua he thong (muc 4.6.1).
 * uk_booking_slots_court_start la lop bao ve cung chong double-booking.
 */
@Entity('booking_slots')
@Index('idx_booking_slots_start_time', ['startTime'])
@Index('idx_booking_slots_status_expires', ['status', 'lockExpiresAt'])
@Index('idx_booking_slots_court_date', ['courtId', 'slotDate'])
@Unique('uk_booking_slots_court_start', ['courtId', 'startTime'])
export class BookingSlotSchema {
  @PrimaryGeneratedColumn({ name: 'slot_id', type: 'int', unsigned: true })
  slotId!: number;

  @Column({ name: 'court_id', type: 'int', unsigned: true })
  courtId!: number;

  @Column({ name: 'slot_date', type: 'date' })
  slotDate!: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime!: Date;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status!: SlotStatus;

  @Column({ name: 'locked_by', type: 'int', unsigned: true, nullable: true })
  lockedBy!: number | null;

  @Column({ name: 'lock_expires_at', type: 'datetime', nullable: true })
  lockExpiresAt!: Date | null;

  @Column({ name: 'booking_id', type: 'int', unsigned: true, nullable: true })
  bookingId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @ManyToOne(() => CourtSchema, (court) => court.slots, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'court_id' })
  court!: CourtSchema;

  @ManyToOne(() => UserSchema, { onDelete: 'SET NULL', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'locked_by' })
  lockedByUser!: UserSchema | null;

  @ManyToOne(() => BookingSchema, (booking) => booking.slots, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: BookingSchema | null;
}
