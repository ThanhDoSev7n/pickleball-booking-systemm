'use client';

import { formatClock } from '@/lib/format';
import { useNowMs } from '@/lib/use-polling';

export interface CountdownTimerProps {
  expiresAtMs: number | null;
  /** Tong thoi gian cua mot lan giu cho, dung ve thanh tien tran */
  totalMs?: number;
  size?: 'sm' | 'lg';
  label?: string;
  showBar?: boolean;
}

function tone(remainingMs: number) {
  if (remainingMs <= 60_000) return { text: 'text-danger-600', bar: 'bg-danger-500', ring: 'border-danger-500/50 bg-danger-50' };
  if (remainingMs <= 120_000) return { text: 'text-warn-700', bar: 'bg-warn-500', ring: 'border-warn-500/50 bg-warn-50' };
  return { text: 'text-brand-700', bar: 'bg-brand-500', ring: 'border-brand-500/40 bg-brand-50' };
}

export function CountdownTimer({ expiresAtMs, totalMs = 300_000, size = 'lg', label = 'Thời gian giữ chỗ còn lại', showBar = true }: CountdownTimerProps) {
  const nowMs = useNowMs();
  if (!expiresAtMs || !nowMs) return null;

  const remainingMs = Math.max(0, expiresAtMs - nowMs);
  const style = tone(remainingMs);
  const percent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const urgent = remainingMs <= 60_000;

  if (size === 'sm') {
    return (
      <span className={`font-mono tabular-nums ${remainingMs <= 60_000 ? 'text-danger-600' : 'text-slate-500'}`}>
        {formatClock(remainingMs / 1000)}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${style.ring} ${urgent ? 'animate-pulse-soft' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold tabular-nums ${style.text}`}>{formatClock(remainingMs / 1000)}</p>
      {showBar ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${style.bar}`} style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
