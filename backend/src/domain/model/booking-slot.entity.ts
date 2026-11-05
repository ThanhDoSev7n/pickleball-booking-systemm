import { DomainError, DomainErrorCode } from '../error/domain.error';
import { canTransitionSlot, SlotStatus } from '../value-object/slot-status.vo';

/**
 * Aggregate root cua Booking Context - muc 4.6.1.
 * Entity thuan TypeScript: khong import bat ky framework nao (NestJS/TypeORM).
 * Toan bo logic chuyen trang thai slot nam o day de unit test duoc bang fake.
 */
export class BookingSlot {
  slotId!: number;
  courtId!: number;
  slotDate!: string;
  startTime!: Date;
  endTime!: Date;
  status!: SlotStatus;
  lockedBy!: number | null;
  lockExpiresAt!: Date | null;
  bookingId!: number | null;
  createdAt!: Date;
  updatedAt!: Date;

  static create(props: {
    courtId: number;
    startTime: Date;
    endTime: Date;
    status?: SlotStatus;
  }): BookingSlot {
    const slot = new BookingSlot();
    slot.courtId = props.courtId;
    slot.startTime = props.startTime;
    slot.endTime = props.endTime;
    slot.slotDate = toDateString(props.startTime);
    slot.status = props.status ?? SlotStatus.AVAILABLE;
    slot.lockedBy = null;
    slot.lockExpiresAt = null;
    slot.bookingId = null;
    return slot;
  }

  isAvailableAt(now: Date): boolean {
    if (this.status === SlotStatus.AVAILABLE) {
      return true;
    }
    // Lazy release (muc 4.7.1): slot LOCKED da het han duoc tinh nhu trong.
    return this.status === SlotStatus.LOCKED && this.isLockExpiredAt(now);
  }

  isLockExpiredAt(now: Date): boolean {
    if (this.status !== SlotStatus.LOCKED || this.lockExpiresAt === null) {
      return false;
    }
    return this.lockExpiresAt.getTime() <= now.getTime();
  }

  isLockedBy(userId: number): boolean {
    return this.status === SlotStatus.LOCKED && this.lockedBy === userId;
  }

  /** Buoc nhay thoi gian giu cho c (lock_expires_at = NOW() + INTERVAL ttl MINUTE). */
  remainingLockSeconds(now: Date): number {
    if (this.lockExpiresAt === null) {
      return 0;
    }
    return Math.max(0, Math.floor((this.lockExpiresAt.getTime() - now.getTime()) / 1000));
  }

  transitionTo(next: SlotStatus): void {
    if (!canTransitionSlot(this.status, next)) {
      throw new DomainError(
        DomainErrorCode.SLOT_NOT_AVAILABLE,
        `Khong the chuyen slot tu ${this.status} sang ${next}`,
        { slotId: this.slotId, from: this.status, to: next },
      );
    }
    this.status = next;
  }

  /** Giu cho cho userId. Idempotent neu chinh user do da giu. */
  lock(userId: number, ttlMinutes: number, now: Date): void {
    if (this.isLockedBy(userId) && !this.isLockExpiredAt(now)) {
      return;
    }
    if (this.status !== SlotStatus.AVAILABLE) {
      if (this.isLockExpiredAt(now)) {
        this.releaseLock();
      } else {
        throw new DomainError(
          DomainErrorCode.SLOT_NOT_AVAILABLE,
          'Slot dang bi giu cho hoac da duoc dat',
          { slotId: this.slotId, status: this.status },
        );
      }
    }
    this.transitionTo(SlotStatus.LOCKED);
    this.lockedBy = userId;
    this.lockExpiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  }

  releaseLock(): void {
    if (this.status !== SlotStatus.LOCKED) {
      return;
    }
    this.transitionTo(SlotStatus.AVAILABLE);
    this.lockedBy = null;
    this.lockExpiresAt = null;
  }

  /** Goi khi user xac nhan dat (STEP 3 muc 4.7.2). */
  markBooked(bookingId: number): void {
    this.transitionTo(SlotStatus.BOOKED);
    this.bookingId = bookingId;
    this.lockedBy = null;
    this.lockExpiresAt = null;
  }

  /** Goi khi booking bi huy de hoan slot ve chung (FR-04). */
  markReleasedFromBooking(): void {
    this.transitionTo(SlotStatus.AVAILABLE);
    this.bookingId = null;
    this.lockedBy = null;
    this.lockExpiresAt = null;
  }

  isPast(now: Date): boolean {
    return this.endTime.getTime() <= now.getTime();
  }
}

export function toDateString(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
