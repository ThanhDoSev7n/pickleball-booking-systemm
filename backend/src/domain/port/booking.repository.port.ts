import { Booking } from '../model/booking.entity';
import { BookingStatus } from '../value-object/booking-status.vo';
import { TransactionHandle } from './transaction.port';

export const BOOKING_REPOSITORY = 'BOOKING_REPOSITORY';

export interface BookingListQuery {
  userId?: number;
  clusterId?: number;
  courtId?: number;
  status?: BookingStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IBookingRepository {
  save(tx: TransactionHandle, booking: Booking): Promise<Booking>;
  findById(bookingId: number): Promise<Booking | null>;
  findByCode(bookingCode: string): Promise<Booking | null>;
  existsByCode(bookingCode: string): Promise<boolean>;
  list(query: BookingListQuery): Promise<Paginated<Booking>>;
  updateStatus(bookingId: number, status: BookingStatus): Promise<void>;
}
