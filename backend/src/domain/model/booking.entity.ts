import { BookingStatus } from '../value-object/booking-status.vo';
import { CANCELLABLE_BOOKING_STATUSES } from '../value-object/booking-status.vo';
import { DomainError, DomainErrorCode } from '../error/domain.error';

/**
 * Viet dat san sau khi slot chuyen sang BOOKED (muc 4.7.2).
 * bookingCode / qrCode dung cho check-in tai quay (FR-07, Thanh vien 3).
 */
export class Booking {
  bookingId!: number;
  bookingCode!: string;
  qrCode!: string;
  userId!: number;
  courtId!: number;
  clusterId!: number;
  startTime!: Date;
  endTime!: Date;
  status!: BookingStatus;
  /** Gia san do Pricing Engine (Thanh vien 2) dien; co the null o thoi diem xac nhan. */
  totalAmount!: number | null;
  slotIds!: number[];
  note!: string | null;
  cancelledAt!: Date | null;
  cancelReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static confirm(props: {
    bookingCode: string;
    qrCode: string;
    userId: number;
    courtId: number;
    clusterId: number;
    startTime: Date;
    endTime: Date;
    slotIds: number[];
    note?: string | null;
    totalAmount?: number | null;
  }): Booking {
    const booking = new Booking();
    booking.bookingCode = props.bookingCode;
    booking.qrCode = props.qrCode;
    booking.userId = props.userId;
    booking.courtId = props.courtId;
    booking.clusterId = props.clusterId;
    booking.startTime = props.startTime;
    booking.endTime = props.endTime;
    booking.slotIds = props.slotIds;
    booking.status = BookingStatus.CONFIRMED;
    booking.note = props.note ?? null;
    booking.totalAmount = props.totalAmount ?? null;
    booking.cancelledAt = null;
    booking.cancelReason = null;
    return booking;
  }

  isOwnedBy(userId: number): boolean {
    return this.userId === userId;
  }

  canCancel(now: Date): boolean {
    return (
      CANCELLABLE_BOOKING_STATUSES.includes(this.status) && this.startTime.getTime() > now.getTime()
    );
  }

  cancel(reason: string, now: Date): void {
    if (!this.canCancel(now)) {
      throw new DomainError(
        DomainErrorCode.BOOKING_NOT_CANCELLABLE,
        'Booking khong the huy theo chinh sach (da check-in, da het gio bat dau hoac da huy)',
        { bookingId: this.bookingId, status: this.status },
      );
    }
    this.status = BookingStatus.CANCELLED;
    this.cancelledAt = now;
    this.cancelReason = reason;
  }

  markPaid(): void {
    if (this.status === BookingStatus.CONFIRMED || this.status === BookingStatus.PENDING) {
      this.status = BookingStatus.PAID;
    }
  }

  markCheckedIn(now: Date): void {
    if (this.status === BookingStatus.PAID || this.status === BookingStatus.CONFIRMED) {
      this.status = BookingStatus.CHECKED_IN;
    } else if (this.status === BookingStatus.CHECKED_IN) {
      return;
    } else {
      throw new DomainError(DomainErrorCode.BOOKING_NOT_FOUND, 'Trang thai khong the check-in', {
        status: this.status,
      });
    }
    void now;
  }
}
