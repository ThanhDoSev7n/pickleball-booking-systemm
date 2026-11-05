import { apiClient } from './client';

export type SlotLockStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'BLOCKED';

export interface LockedSlot {
  slotId: number;
  courtId: number;
  status: SlotLockStatus | string;
  lockExpiresAt: string;
}

export interface LockResult {
  lockedSlots: LockedSlot[];
  ttlMinutes: number;
  lockExpiresAt: string;
  remainingSeconds: number;
}

export interface ReleaseResult {
  slotId: number;
  status: string;
}

export interface BookingSlotItem {
  slotId: number;
  courtId?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export interface BookingDetail {
  bookingId: number;
  bookingCode: string;
  qrCode?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount?: number | null;
  note?: string | null;
  courtName?: string | null;
  clusterName?: string | null;
  city?: string | null;
  slots?: BookingSlotItem[];
  createdAt?: string;
}

export interface BookingListResult {
  items: BookingDetail[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConfirmPayload {
  slotIds: number[];
  note?: string;
  expectedTotalAmount?: number;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  LOCKED: 'Đang giữ chỗ',
  HELD: 'Đang giữ chỗ',
  PENDING_CHECKIN: 'Chờ check-in',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PAID: 'Đã thanh toán',
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

export function isCancellable(status: string): boolean {
  const value = status?.toUpperCase?.() ?? '';
  return value !== 'CANCELLED' && value !== 'COMPLETED' && value !== 'CHECKED_IN';
}

export async function lockSlots(slotIds: number[]): Promise<LockResult> {
  const { data } = await apiClient.post<LockResult>('/bookings/lock', { slotIds });
  return data;
}

export async function releaseSlot(slotId: number): Promise<ReleaseResult> {
  const { data } = await apiClient.delete<ReleaseResult>(`/bookings/lock/${slotId}`);
  return data;
}

export async function confirmBooking(payload: ConfirmPayload): Promise<BookingDetail> {
  const { data } = await apiClient.post<BookingDetail>('/bookings/confirm', payload);
  return data;
}

export async function listBookings(page = 1, pageSize = 10): Promise<BookingListResult> {
  const { data } = await apiClient.get<Partial<BookingListResult>>('/bookings', {
    params: { page, pageSize },
  });
  return {
    items: Array.isArray(data?.items) ? data.items : Array.isArray(data) ? (data as unknown as BookingDetail[]) : [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
  };
}

/** Backend that dung POST /bookings/:bookingId/cancel (khong phai DELETE). */
export async function cancelBooking(bookingId: number): Promise<BookingDetail> {
  const { data } = await apiClient.post<BookingDetail>(`/bookings/${bookingId}/cancel`);
  return data;
}
