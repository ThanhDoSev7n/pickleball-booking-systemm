import { Module } from '@nestjs/common';
import { SlotLockReleaseTask } from '../infrastructure/scheduler/slot-lock-release.task';
import { BookingModule } from './booking.module';

/** Chua cac job chu dong cua Booking Context. */
@Module({
  imports: [BookingModule],
  providers: [SlotLockReleaseTask],
})
export class SchedulerModule {}
