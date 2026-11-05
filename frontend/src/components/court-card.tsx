'use client';

import Link from 'next/link';
import { courtTypeLabel, type UiCourt, type UiSlot } from '@/lib/api/availability-api';
import { SlotGrid } from './slot-grid';

export interface CourtCardProps {
  court: UiCourt;
  selectedIds: Set<number>;
  heldIds: Set<number>;
  onToggleSlot: (slot: UiSlot, court: UiCourt) => void;
  nowMs: number;
  busy?: boolean;
  showDetailLink?: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  OUTDOOR: 'bg-court-50 text-court-600 border-court-500/30',
  INDOOR: 'bg-brand-50 text-brand-700 border-brand-500/30',
  COMPETITION: 'bg-warn-50 text-warn-700 border-warn-500/30',
};

export function CourtCard({ court, selectedIds, heldIds, onToggleSlot, nowMs, busy = false, showDetailLink = true }: CourtCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">{court.courtName}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[court.courtType] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {courtTypeLabel(court.courtType)}
            </span>
            {selectedIds.size > 0 ? (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                Đã chọn {court.slots.filter((slot) => selectedIds.has(slot.slotId)).length}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {court.clusterName} · {court.city}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {court.availableCount} khung giờ trống
          </span>
          {showDetailLink ? (
            <Link href={`/san/${court.courtId}`} className="text-sm font-medium text-brand-700 hover:underline">
              Xem chi tiết
            </Link>
          ) : null}
        </div>
      </div>
      <SlotGrid
        slots={court.slots}
        selectedIds={selectedIds}
        heldIds={heldIds}
        onToggle={(slot) => onToggleSlot(slot, court)}
        nowMs={nowMs}
        busy={busy}
      />
    </section>
  );
}
