'use client';

import { useState } from 'react';
import { bookingStatusLabel, isCancellable, type BookingDetail } from '@/lib/api/booking-api';
import { formatDate, formatTime } from '@/lib/format';
import { PRICE_PENDING_MESSAGE } from './booking-summary';
import { QrCode } from './qr-code';
import { Spinner } from './spinner';

const STATUS_STYLE: Record<string, string> = {
  PENDING_CHECKIN: 'bg-warn-50 text-warn-700 border-warn-500/40',
  CONFIRMED: 'bg-warn-50 text-warn-700 border-warn-500/40',
  LOCKED: 'bg-court-50 text-court-600 border-court-500/40',
  CHECKED_IN: 'bg-brand-50 text-brand-700 border-brand-500/40',
  COMPLETED: 'bg-slate-100 text-slate-600 border-slate-300',
  CANCELLED: 'bg-danger-50 text-danger-600 border-danger-500/40',
};

export interface BookingHistoryItemProps {
  booking: BookingDetail;
  onCancel: (booking: BookingDetail) => void;
  busy?: boolean;
}

export function BookingHistoryItem({ booking, onCancel, busy = false }: BookingHistoryItemProps) {
  const [showQr, setShowQr] = useState(false);
  const status = (booking.status ?? '').toUpperCase();
  const rows = booking.slots?.length
    ? booking.slots.map((slot) => ({ key: `slot-${slot.slotId}`, slotId: slot.slotId, startTime: slot.startTime, endTime: slot.endTime }))
    : [{ key: 'booking', slotId: undefined as number | undefined, startTime: booking.startTime, endTime: booking.endTime }];
  const total = booking.totalAmount ?? null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mã đặt sân</p>
          <p className="font-mono text-lg font-bold text-slate-800">{booking.bookingCode}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status] ?? 'border-slate-300 bg-slate-50 text-slate-600'}`}>
          {bookingStatusLabel(booking.status)}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-800">{formatDate(booking.startTime)}</span> · {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
        </p>
        {booking.courtName ? (
          <p>
            {booking.courtName}
            {booking.clusterName ? ` · ${booking.clusterName}` : ''}
            {booking.city ? ` · ${booking.city}` : ''}
          </p>
        ) : (
          <p>{booking.slots?.length ?? 0} khung giờ đã đặt</p>
        )}
        {total !== null ? <p className="font-semibold text-brand-700">{`${total.toLocaleString('vi-VN')} đồng`}</p> : <p className="italic text-slate-500">{PRICE_PENDING_MESSAGE}</p>}
        {booking.note ? <p className="text-xs text-slate-500">Ghi chú: {booking.note}</p> : null}
      </div>

      <ul className="mt-3 space-y-1">
        {rows.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {item.slotId ? `Slot #${item.slotId} · ` : ''}
            {item.startTime ? `${formatTime(item.startTime)} – ${formatTime(item.endTime)}` : 'Khung giờ không xác định'}
          </li>
        ))}
      </ul>

      {showQr && (booking.qrCode || booking.bookingCode) ? (
        <div className="mt-4 flex justify-center">
          <QrCode value={booking.qrCode ?? booking.bookingCode} size={180} caption={`QR check-in ${booking.bookingCode}`} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowQr((value) => !value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showQr ? 'Ẩn mã QR' : 'Xem mã QR check-in'}
        </button>
        {isCancellable(booking.status) ? (
          <button
            type="button"
            onClick={() => onCancel(booking)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-danger-500/50 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4" /> : null}
            Hủy đặt sân
          </button>
        ) : null}
      </div>
    </article>
  );
}
