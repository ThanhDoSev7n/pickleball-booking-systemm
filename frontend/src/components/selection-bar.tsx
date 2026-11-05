'use client';

import Link from 'next/link';
import { formatClock } from '@/lib/format';
import { Spinner } from './spinner';

export interface SelectionBarProps {
  selectedCount: number;
  selectedLabel: string | null;
  heldCount: number;
  remainingMs: number;
  locking: boolean;
  onClear: () => void;
  onLock: () => void;
}

export function SelectionBar({ selectedCount, selectedLabel, heldCount, remainingMs, locking, onClear, onLock }: SelectionBarProps) {
  if (selectedCount === 0 && heldCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {selectedCount > 0 ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-800">
              Đã chọn {selectedCount} khung giờ{selectedLabel ? ` · ${selectedLabel}` : ''}
            </p>
            <p className="text-xs text-slate-500">Giá sẽ được tính khi lễ tân xác nhận.</p>
          </div>
        ) : (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-court-600">
              Bạn đang giữ {heldCount} khung giờ · còn {formatClock(remainingMs / 1000)}
            </p>
            <p className="text-xs text-slate-500">Làm mới danh sách để chọn thêm sân khác.</p>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <button type="button" onClick={onClear} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Bỏ chọn
            </button>
          ) : null}
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onLock}
              disabled={locking}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {locking ? <Spinner className="size-4" /> : null}
              {locking ? 'Đang giữ chỗ…' : 'Giữ chỗ 5 phút'}
            </button>
          ) : (
            <Link href="/dat-chong" className="rounded-lg bg-court-500 px-4 py-2 text-sm font-semibold text-white hover:bg-court-600">
              Đến trang đặt chông
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
