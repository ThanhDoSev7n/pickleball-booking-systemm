'use client';

import { formatDate, formatTime, formatVnd } from '@/lib/format';
import { courtTypeLabel } from '@/lib/api/availability-api';
import type { CartSlot, HeldSlot } from '@/lib/booking-cart-context';

export interface BookingSummaryProps {
  slots: Array<CartSlot | HeldSlot>;
  title?: string;
  totalAmount?: number | null;
  note?: string | null;
  emptyText?: string;
}

export const PRICE_PENDING_MESSAGE = 'Giá sẽ được tính khi lễ tân xác nhận';

export function BookingSummary({ slots, title = 'Khung giờ đã chọn', totalAmount, note, emptyText = 'Chưa chọn khung giờ nào.' }: BookingSummaryProps) {
  const money = formatVnd(totalAmount);

  if (!slots.length) {
    return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{title}</p>
      <ul className="divide-y divide-slate-100">
        {slots.map((slot) => (
          <li key={slot.slotId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">
                {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                <span className="ml-2 text-xs font-normal text-slate-500">{formatDate(slot.startTime)}</span>
              </p>
              <p className="text-xs text-slate-500">
                {slot.courtName} · {courtTypeLabel(slot.courtType)} · {slot.clusterName} ({slot.city})
              </p>
              {'lockExpiresAt' in slot ? <p className="mt-0.5 text-xs text-court-600">Slot #{slot.slotId} đang giữ chỗ</p> : null}
            </div>
            <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">Slot #{slot.slotId}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Tổng thanh toán</span>
        {money ? <span className="text-base font-bold text-brand-700">{money}</span> : <span className="text-sm italic text-slate-500">{PRICE_PENDING_MESSAGE}</span>}
      </div>
      {note ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú cho lễ tân</p>
          <p className="mt-1 text-sm text-slate-700">{note}</p>
        </div>
      ) : null}
    </div>
  );
}
