/**
 * Vong doi booking (muc 4.5.1 - state machine AVAILABLE -> LOCKED -> BOOKED -> CANCELLED).
 * PAID duoc ghi boi le tan tai quay (ADR-004: khong tich hop cong thanh toan online).
 */
export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export const CANCELLABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.PAID,
];
