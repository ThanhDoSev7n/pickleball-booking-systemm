import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundDomainError,
} from '../../../domain/error/domain.error';
import { Booking } from '../../../domain/model/booking.entity';
import { BOOKING_REPOSITORY, IBookingRepository } from '../../../domain/port/booking.repository.port';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import { SLOT_REPOSITORY, ISlotRepository } from '../../../domain/port/slot.repository.port';
import { TRANSACTION_MANAGER, ITransactionManager } from '../../../domain/port/transaction.port';
import { SLOT_LOCK_MANAGER, SlotLockManager } from '../../../domain/service/slot-lock.manager';
import { toBookingView, BookingView } from '../../serialization/booking-view';

const CODE_PREFIX = 'PKL';
const CODE_RANDOM_LENGTH = 6;
/** Bo ky tu loai bo I/O/0/1 tranh sai khi nhan vien go thu cong ma dat. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_ATTEMPTS = 10;
/** Don dat sap dien ra duoc coi la "gap" - chi log, khong push notification. */
const URGENT_BOOKING_MINUTES = 60;

export interface ConfirmBookingInput {
  slotIds: number[];
  userId: number;
  note?: string | null;
  /** Gia tu Pricing Engine (Thanh vien 2); null khi module chua keo gia. */
  expectedTotalAmount?: number | null;
}

/**
 * Muc 4.7.2 (STEP 1-5): xac nhan dat sau khi co giu cho.
 * Toan bo read/write lien quan den slot nam trong MOT transaction;
 * doc reference data (san, cum san) va sinh ma dat lam ngoai transaction
 * de thoi gian giu InnoDB record lock du ngan nhat co the (muc 4.1.3).
 */
@Injectable()
export class ConfirmBookingUseCase {
  private readonly logger = new Logger(ConfirmBookingUseCase.name);

  constructor(
    @Inject(SLOT_REPOSITORY) private readonly slots: ISlotRepository,
    @Inject(BOOKING_REPOSITORY) private readonly bookings: IBookingRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: ITransactionManager,
    @Inject(SLOT_LOCK_MANAGER) private readonly slotLock: SlotLockManager,
  ) {}

  async execute(input: ConfirmBookingInput): Promise<BookingView> {
    const now = new Date();
    const slotIds = [...new Set(input.slotIds)];
    if (slotIds.length === 0) {
      throw new DomainError(DomainErrorCode.SLOT_NOT_FOUND, 'Chua chon khung gio nao');
    }

    const slotSnapshot = await this.slots.findByIds(null, slotIds);
    if (slotSnapshot.length !== slotIds.length) {
      const found = new Set(slotSnapshot.map((slot) => slot.slotId));
      const missing = slotIds.filter((slotId) => !found.has(slotId));
      throw new NotFoundDomainError(
        DomainErrorCode.SLOT_NOT_FOUND,
        `Mot so khung gio khong ton tai: ${missing.join(', ')}`,
        { missingSlotIds: missing },
      );
    }

    const courtIds = [...new Set(slotSnapshot.map((slot) => slot.courtId))];
    if (courtIds.length > 1) {
      // bookings chi co MOT cot court_id (schema muc 4.6) nen don dat khong the trai san.
      throw new ForbiddenError('Mot don dat chi duoc phep tren cung mot san', { courtIds });
    }

    const courtRows = await this.courts.findCourtsByIds(courtIds);
    if (courtRows.length !== courtIds.length) {
      throw new NotFoundDomainError(DomainErrorCode.SLOT_NOT_FOUND, 'San cua khung gio khong ton tai', {
        courtIds,
      });
    }
    const court = courtRows[0];
    if (!court.isActive) {
      throw new DomainError(
        DomainErrorCode.SLOT_NOT_AVAILABLE,
        `San ${court.name} dang ngung hoat dong`,
        { courtId: court.courtId },
      );
    }

    const cluster = await this.courts.findClusterById(court.clusterId);
    if (cluster === null || !cluster.isBookable()) {
      throw new DomainError(
        DomainErrorCode.CLUSTER_NOT_APPROVED,
        'Cum san chua duoc Admin duyet nen khong the dat',
        { clusterId: court.clusterId, status: cluster?.status ?? 'NOT_FOUND' },
      );
    }

    const { bookingCode, qrCode } = await this.generateIdentifiers(now);
    const created = await this.transactions.runInTransaction(async (tx) => {
      // Buoc 2 muc 4.7.2: SELECT ... FOR UPDATE + xac minh van la nguoi giu cho.
      const heldSlots = await this.slotLock.assertLockHeld(tx, slotIds, input.userId, now);
      const booking = Booking.confirm({
        bookingCode,
        qrCode,
        userId: input.userId,
        courtId: court.courtId,
        clusterId: court.clusterId,
        startTime: minStartTime(heldSlots),
        endTime: maxEndTime(heldSlots),
        slotIds: heldSlots.map((slot) => slot.slotId),
        note: input.note ?? null,
        totalAmount: input.expectedTotalAmount ?? null,
      });
      const persisted = await this.bookings.save(tx, booking);
      // Buoc 4: slot LOCKED -> BOOKED, gan booking_id.
      for (const slot of heldSlots) {
        slot.markBooked(persisted.bookingId);
        await this.slots.save(tx, slot);
      }
      return { persisted, slotIds: heldSlots.map((slot) => slot.slotId) };
    });

    this.logIfUpcoming(created.persisted, now);
    return toBookingView(created.persisted, created.slotIds);
  }

  /** trung uk_bookings_booking_code thi sinh lai; day la guard phang vi xac suat trung gan bang 0. */
  private async generateIdentifiers(now: Date): Promise<{ bookingCode: string; qrCode: string }> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const bookingCode = buildBookingCode(now);
      if (!(await this.bookings.existsByCode(bookingCode))) {
        return { bookingCode, qrCode: randomUUID() };
      }
    }
    throw new DomainError(
      DomainErrorCode.DEADLOCK_RETRY_EXHAUSTED,
      'Khong the sinh ma dat moi, vui long thu lai',
      { attempts: MAX_CODE_ATTEMPTS },
    );
  }

  private logIfUpcoming(booking: Booking, now: Date): void {
    const minutesUntilStart = Math.round(
      (booking.startTime.getTime() - now.getTime()) / 60_000,
    );
    if (minutesUntilStart <= URGENT_BOOKING_MINUTES) {
      // Notification/Email la phuc vu cua module khac, ngoai pham vi member 1.
      this.logger.warn(
        `Don ${booking.bookingCode} bat dau sau ${minutesUntilStart} phut - can nhan vien theo sat`,
      );
    }
  }
}

function buildBookingCode(now: Date): string {
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  let random = '';
  for (let i = 0; i < CODE_RANDOM_LENGTH; i += 1) {
    random += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}-${datePart}-${random}`;
}

function minStartTime(slots: { startTime: Date }[]): Date {
  return slots.reduce(
    (earliest, slot) => (slot.startTime.getTime() < earliest.getTime() ? slot.startTime : earliest),
    slots[0].startTime,
  );
}

function maxEndTime(slots: { endTime: Date }[]): Date {
  return slots.reduce(
    (latest, slot) => (slot.endTime.getTime() > latest.getTime() ? slot.endTime : latest),
    slots[0].endTime,
  );
}
