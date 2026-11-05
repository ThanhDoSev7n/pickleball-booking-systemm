import { Booking } from '../../domain/model/booking.entity';

/** View booking tra ra HTTP - khong lo entity/ORM row. */
export interface BookingView {
  bookingId: number;
  bookingCode: string;
  qrCode: string;
  userId: number;
  courtId: number;
  clusterId: number;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number | null;
  slotIds: number[];
  note: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string | null;
}

export function toBookingView(booking: Booking, slotIds?: number[]): BookingView {
  return {
    bookingId: booking.bookingId,
    bookingCode: booking.bookingCode,
    qrCode: booking.qrCode,
    userId: booking.userId,
    courtId: booking.courtId,
    clusterId: booking.clusterId,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
    totalAmount: booking.totalAmount,
    // Cot slot_ids khong ton tai trong schema: quan he nam o booking_slots.booking_id.
    slotIds: slotIds ?? booking.slotIds,
    note: booking.note,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancelReason: booking.cancelReason,
    createdAt: booking.createdAt?.toISOString() ?? null,
  };
}
