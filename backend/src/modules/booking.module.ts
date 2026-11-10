import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOOKING_REPOSITORY } from '../domain/port/booking.repository.port';
import { SLOT_REPOSITORY } from '../domain/port/slot.repository.port';
import { TRANSACTION_MANAGER } from '../domain/port/transaction.port';
import { SLOT_LOCK_MANAGER, SlotLockManager } from '../domain/service/slot-lock.manager';
import { ConfirmBookingUseCase } from '../application/use-case/booking/confirm-booking.use-case';
import {
  CancelBookingUseCase,
  GetBookingDetailUseCase,
  GetMyBookingsUseCase,
} from '../application/use-case/booking/manage-bookings.use-case';
import { LockSlotsUseCase } from '../application/use-case/booking/lock-slots.use-case';
import { ReleaseExpiredLocksUseCase } from '../application/use-case/booking/release-expired-locks.use-case';
import { ReleaseSlotUseCase } from '../application/use-case/booking/release-slot.use-case';
import { SearchAvailabilityUseCase } from '../application/use-case/booking/search-availability.use-case';
import { BookingSchema } from '../infrastructure/persistence/typeorm/entities/booking.schema';
import { BookingSlotSchema } from '../infrastructure/persistence/typeorm/entities/booking-slot.schema';
import { TypeOrmBookingRepository } from '../infrastructure/persistence/typeorm/repositories/booking.repository';
import { TypeOrmSlotRepository } from '../infrastructure/persistence/typeorm/repositories/slot.repository';
import { TypeOrmTransactionManager } from '../infrastructure/persistence/typeorm/typeorm-transaction.manager';
import { AvailabilityController } from '../presentation/http/controllers/availability.controller';
import { BookingController } from '../presentation/http/controllers/booking.controller';
import { CourtModule } from './court.module';
import { IdentityModule } from './identity.module';
import { PricingModule } from './pricing.module';

const DEFAULT_LOCK_TTL_MINUTES = 5;
const DEFAULT_DEADLOCK_MAX_RETRIES = 3;
const DEADLOCK_BACKOFF_BASE_MS = 25;

/** Booking Context: slot lock + don dat + tra cuu kha nang dat. */
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingSlotSchema, BookingSchema]),
    CourtModule,
    IdentityModule,
    PricingModule,
    ConfigModule,
  ],
  providers: [
    { provide: SLOT_REPOSITORY, useClass: TypeOrmSlotRepository },
    { provide: BOOKING_REPOSITORY, useClass: TypeOrmBookingRepository },
    // Repository can resolve() lay EntityManager dang mo nen giu class va alias token, tranh duplicate instance.
    TypeOrmTransactionManager,
    { provide: TRANSACTION_MANAGER, useExisting: TypeOrmTransactionManager },
    {
      provide: SLOT_LOCK_MANAGER,
      // Domain service thuan TypeScript: module la noi doc config de xong tham so.
      useFactory: (
        slotRepository: TypeOrmSlotRepository,
        transactionManager: TypeOrmTransactionManager,
        config: ConfigService,
      ): SlotLockManager =>
        new SlotLockManager(slotRepository, transactionManager, {
          ttlMinutes: Number(config.get('LOCK_TTL_MINUTES', DEFAULT_LOCK_TTL_MINUTES)),
          deadlockMaxRetries: Number(config.get('DEADLOCK_MAX_RETRIES', DEFAULT_DEADLOCK_MAX_RETRIES)),
          deadlockBackoffBaseMs: DEADLOCK_BACKOFF_BASE_MS,
        }),
      inject: [SLOT_REPOSITORY, TRANSACTION_MANAGER, ConfigService],
    },
    SearchAvailabilityUseCase,
    LockSlotsUseCase,
    ReleaseSlotUseCase,
    ConfirmBookingUseCase,
    GetMyBookingsUseCase,
    GetBookingDetailUseCase,
    CancelBookingUseCase,
    ReleaseExpiredLocksUseCase,
  ],
  controllers: [AvailabilityController, BookingController],
  exports: [
    SLOT_REPOSITORY,
    BOOKING_REPOSITORY,
    TRANSACTION_MANAGER,
    SLOT_LOCK_MANAGER,
    SearchAvailabilityUseCase,
    LockSlotsUseCase,
    ReleaseSlotUseCase,
    ConfirmBookingUseCase,
    GetMyBookingsUseCase,
    GetBookingDetailUseCase,
    CancelBookingUseCase,
    ReleaseExpiredLocksUseCase,
  ],
})
export class BookingModule {}
