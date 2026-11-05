'use client';

import type { ReactNode } from 'react';
import { Spinner } from './spinner';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Quay lại',
  tone = 'brand',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-danger-600 hover:bg-danger-500 text-white'
      : 'bg-brand-600 hover:bg-brand-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? <Spinner className="size-4" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
