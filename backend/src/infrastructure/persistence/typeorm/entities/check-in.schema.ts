import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('booking_check_ins')
@Unique('uk_booking_check_ins_booking', ['bookingId'])
export class CheckInSchema {
  @PrimaryGeneratedColumn({ name: 'check_in_id', type: 'int', unsigned: true }) checkInId!: number;
  @Column({ name: 'booking_id', type: 'int', unsigned: true }) bookingId!: number;
  @Column({ name: 'staff_user_id', type: 'int', unsigned: true }) staffUserId!: number;
  @CreateDateColumn({ name: 'checked_in_at', type: 'datetime' }) checkedInAt!: Date;
}
