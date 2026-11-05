import { BookingSlot } from '../model/booking-slot.entity';
import { CourtType } from '../value-object/court-type.vo';
import { SlotStatus } from '../value-object/slot-status.vo';
import { TransactionHandle } from './transaction.port';

export const SLOT_REPOSITORY = 'SLOT_REPOSITORY';

export interface SlotQueryFilter {
  date: string;
  clusterId?: number;
  courtId?: number;
  courtType?: CourtType;
  city?: string;
  /** Bo loc theo khung gio bat dau trong ngay (VD: chi xem sau 16:00). */
  timeFrom?: string;
  timeTo?: string;
}

/**
 * Port persistence cho Booking Context.
 * Cac phuong thuc co doi so `tx` bat buoc duoc goi ben trong runInTransaction
 * va dung khoa bi quan (pessimistic) khi can.
 */
export interface ISlotRepository {
  /**
   * SELECT ... FOR UPDATE - InnoDB record lock. Tra ve null neu slot ton tai nhung
   * khong thoa man dieu kien status (xem findAvailableForUpdate).
   */
  findForUpdate(tx: TransactionHandle, slotId: number): Promise<BookingSlot | null>;

  /** Doc rong, khong lay khoa - dung cho lazy check va hien thi. */
  findById(tx: TransactionHandle | null, slotId: number): Promise<BookingSlot | null>;

  findByIds(tx: TransactionHandle | null, slotIds: number[]): Promise<BookingSlot[]>;

  findByBookingId(bookingId: number): Promise<BookingSlot[]>;

  save(tx: TransactionHandle, slot: BookingSlot): Promise<BookingSlot>;

  saveMany(tx: TransactionHandle, slots: BookingSlot[]): Promise<BookingSlot[]>;

  /** Tra van "tim slot trong cua san X trong khoang thoi gian Y" - idx_booking_slots_start_time. */
  search(filter: SlotQueryFilter, now: Date): Promise<BookingSlot[]>;

  listByCourtAndRange(courtId: number, from: Date, to: Date): Promise<BookingSlot[]>;

  /**
   * Bulk release (muc 4.7.1):
   * UPDATE booking_slots SET status='AVAILABLE', locked_by=NULL, lock_expires_at=NULL
   *  WHERE status='LOCKED' AND lock_expires_at < NOW()
   */
  releaseExpiredLocks(now: Date): Promise<number>;

  findByStatusOlderThan(status: SlotStatus, cutoff: Date): Promise<BookingSlot[]>;

  countByStatusForDate(date: string): Promise<Record<SlotStatus, number>>;

  /** Tao truot cac slot trong ngay neu chua co (idempotent nho UNIQUE (court_id, start_time)). */
  ensureSlotsExist(courtIds: number[], date: string): Promise<number>;
}
