'use client';

import { formatClock, formatTime } from '@/lib/format';
import type { UiSlot } from '@/lib/api/availability-api';

export interface SlotGridProps {
  slots: UiSlot[];
  selectedIds: Set<number>;
  heldIds: Set<number>;
  onToggle: (slot: UiSlot) => void;
  nowMs: number;
  busy?: boolean;
}

type TileState = 'selected' | 'heldByMe' | 'held' | 'available';

function stateOf(slot: UiSlot, selectedIds: Set<number>, heldIds: Set<number>): TileState {
  // Server la nguon chan ly: slot da co nguoi giu thi khong duoc de selection
  // cu cua minh che mat trang thai do (neu khong user bam lock mai ma khong duoc).
  if (slot.availability === 'HELD') {
    return heldIds.has(slot.slotId) ? 'heldByMe' : 'held';
  }
  if (selectedIds.has(slot.slotId)) return 'selected';
  if (heldIds.has(slot.slotId)) return 'heldByMe';
  return 'available';
}

const TILE_STYLES: Record<TileState, string> = {
  selected: 'border-brand-600 bg-brand-600 text-white shadow-sm',
  heldByMe: 'border-court-500 bg-court-50 text-court-600',
  held: 'border-slate-200 bg-slate-100 text-slate-400',
  available: 'border-slate-300 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50',
};

const CAPTION_COLOR: Record<TileState, string> = {
  selected: 'text-white/90',
  heldByMe: 'text-court-600',
  held: 'text-slate-500',
  available: 'text-slate-500',
};

export function SlotGrid({ slots, selectedIds, heldIds, onToggle, nowMs, busy = false }: SlotGridProps) {
  if (!slots.length) {
    return <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Sân này không có khung giờ nào trùng điều kiện lọc.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {slots.map((slot) => {
        const state = stateOf(slot, selectedIds, heldIds);
        const clickable = (state === 'available' || state === 'selected') && !busy;
        const remainingMs = slot.holdExpiresAtMs && nowMs ? Math.max(0, slot.holdExpiresAtMs - nowMs) : 0;

        let caption = 'Còn trống';
        if (state === 'selected') caption = 'Đã chọn';
        if (state === 'heldByMe') caption = `Bạn đang giữ · ${formatClock(remainingMs / 1000)}`;
        if (state === 'held') caption = `Đang có người giữ (còn ${formatClock(remainingMs / 1000)})`;

        return (
          <button
            key={slot.slotId}
            type="button"
            disabled={!clickable}
            onClick={() => onToggle(slot)}
            aria-pressed={state === 'selected'}
            title={state === 'held' ? 'Khung giờ đang được người khác giữ chỗ' : undefined}
            className={`flex min-h-17 flex-col items-start justify-between gap-1 rounded-xl border px-3 py-2 text-left transition ${TILE_STYLES[state]} ${
              state === 'available' || state === 'selected' ? 'cursor-pointer' : 'cursor-not-allowed'
            } ${busy ? 'opacity-60' : ''}`}
          >
            <span className="text-sm font-semibold tabular-nums">
              {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
            </span>
            <span className={`text-xs leading-snug ${CAPTION_COLOR[state]}`}>{caption}</span>
          </button>
        );
      })}
    </div>
  );
}
