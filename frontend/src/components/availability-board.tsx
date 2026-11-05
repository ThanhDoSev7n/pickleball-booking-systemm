'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  decorateCourts,
  fetchAvailability,
  type AvailabilityQuery,
  type UiCourt,
  type UiSlot,
} from '@/lib/api/availability-api';
import { apiErrorMessage, isNetworkError, isSlotTakenError } from '@/lib/error-message';
import { formatTime, todayKey } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useBookingCart, type CartSlot } from '@/lib/booking-cart-context';
import { useNowMs, usePolling } from '@/lib/use-polling';
import { AlertBanner, type AlertTone } from './alert-banner';
import { AvailabilityFilter } from './availability-filter';
import { CourtCard } from './court-card';
import { CourtCardSkeleton, Spinner } from './spinner';
import { EmptyState } from './empty-state';
import { SelectionBar } from './selection-bar';

const POLL_MS = 15_000;

const DEFAULT_QUERY: AvailabilityQuery = { date: '', city: '', courtType: '', timeFrom: '', timeTo: '' };

const DEFAULT_CITIES = ['Ha Noi', 'Ho Chi Minh', 'Da Nang', 'Can Tho', 'Hai Phong'];

interface Notice {
  tone: AlertTone;
  title: string;
  message: string;
}

export function AvailabilityBoard({ courtId }: { courtId?: number }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const cart = useBookingCart();
  const [query, setQuery] = useState<AvailabilityQuery>({ ...DEFAULT_QUERY, courtId });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [polling, setPolling] = useState(true);
  const nowMs = useNowMs();

  // Date mac dinh gan sau microtask: tranh lech giua HTML server va render dau tien o client
  useEffect(() => {
    queueMicrotask(() => setQuery((current) => (current.date ? current : { ...current, date: todayKey() })));
  }, []);

  const queryKey = JSON.stringify({ ...query, courtId });

  const { data, error, loading, refreshing, lastUpdatedAt, refresh } = usePolling(
    async () => {
      const result = await fetchAvailability({ ...query, courtId });
      const courts = decorateCourts(result, Date.now());
      return { date: result.date, courts };
    },
    { intervalMs: polling ? POLL_MS : 0, enabled: Boolean(query.date), deps: [queryKey] },
  );

  // Giu cho het han (5 phut) -> bao cho user biet va refresh lai luoi slot
  const handledExpiry = useRef(0);
  useEffect(() => {
    if (cart.expirySignal === 0 || handledExpiry.current === cart.expirySignal) return;
    handledExpiry.current = cart.expirySignal;
    queueMicrotask(() => {
      setNotice({
        tone: 'warning',
        title: 'Hết thời gian giữ chỗ',
        message: 'Các khung giờ bạn giữ đã hết hạn và được mở lại cho người khác.',
      });
      void refresh();
    });
  }, [cart.expirySignal, refresh]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CITIES);
    data?.courts.forEach((court) => court.city && set.add(court.city));
    return Array.from(set);
  }, [data]);

  const patchQuery = useCallback((patch: Partial<AvailabilityQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
    setNotice(null);
  }, []);

  const resetQuery = useCallback(() => {
    setQuery({ ...DEFAULT_QUERY, date: todayKey(), courtId });
    setNotice(null);
  }, [courtId]);

  const selectedIds = useMemo(() => new Set(cart.selection.map((slot) => slot.slotId)), [cart.selection]);

  const handleToggle = useCallback(
    (slot: UiSlot, court: UiCourt) => {
      const payload: CartSlot = {
        slotId: slot.slotId,
        courtId: court.courtId,
        courtName: court.courtName,
        courtType: court.courtType,
        clusterId: court.clusterId,
        clusterName: court.clusterName,
        city: court.city,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
      const result = cart.toggleSlot(payload);
      if (!result.ok && result.reason === 'CROSS_COURT') {
        setNotice({
          tone: 'warning',
          title: 'Chỉ chọn được cùng một sân',
          message: 'Hãy bỏ chọn khung giờ hiện tại trước khi chọn sân khác.',
        });
      }
    },
    [cart],
  );

  const handleLock = useCallback(async () => {
    if (!isAuthenticated) {
      setNotice({ tone: 'info', title: 'Cần đăng nhập', message: 'Bạn hãy đăng nhập để giữ chỗ khung giờ đã chọn.' });
      router.push('/dang-nhap');
      return;
    }
    const outcome = await cart.lockSelection();
    if (!outcome.ok) {
      setNotice({
        tone: 'error',
        title: 'Không giữ chỗ được',
        message: apiErrorMessage(outcome.error),
      });
      // 409 SLOT_NOT_AVAILABLE -> phai load lai luoi slot
      if (isSlotTakenError(outcome.error) || isNetworkError(outcome.error)) void refresh();
      return;
    }
    setNotice(null);
    router.push('/dat-chong');
  }, [cart, isAuthenticated, refresh, router]);

  const selectedLabel = cart.selection[0]?.courtName ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <AvailabilityFilter query={query} cityOptions={cityOptions} onChange={patchQuery} onReset={resetQuery} disabled />
        <div className="grid gap-4">
          <CourtCardSkeleton />
          <CourtCardSkeleton />
        </div>
        {error ? <NetworkNotice error={error} onRetry={refresh} /> : null}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${cart.selectedCount || cart.heldCount ? 'pb-28' : ''}`}>
      <AvailabilityFilter query={query} cityOptions={cityOptions} onChange={patchQuery} onReset={resetQuery} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-slate-300 bg-white" /> Còn trống
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-600" /> Đã chọn
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-slate-200 bg-slate-100" /> Đang có người giữ
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          {refreshing ? <Spinner className="size-3.5 text-brand-600" /> : null}
          Tự động làm mới mỗi {POLL_MS / 1000}s
          {lastUpdatedAt ? ` · ${formatTime(lastUpdatedAt)}` : ''}
          <button
            type="button"
            onClick={() => setPolling((value) => !value)}
            className="rounded-md border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            {polling ? 'Tạm dừng' : 'Chạy lại'}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            Làm mới
          </button>
        </span>
      </div>

      {notice ? (
        <AlertBanner tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
          {notice.message}
        </AlertBanner>
      ) : null}

      {error ? <NetworkNotice error={error} onRetry={refresh} /> : null}

      {!data?.courts.length ? (
        <EmptyState
          title="Chưa có sân nào phù hợp"
          description={
            error
              ? 'Thử kiểm tra backend đã chạy chưa (http://localhost:3000), hoặc đổi bộ lọc ngày / thành phố.'
              : 'Đổi ngày, thành phố hoặc loại sân khác để xem khung giờ trống.'
          }
          action={
            <button type="button" onClick={() => void refresh()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Tải lại
            </button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {data.courts.map((court) => (
            <CourtCard
              key={court.courtId}
              court={court}
              selectedIds={selectedIds}
              heldIds={cart.heldSlotIds}
              onToggleSlot={handleToggle}
              nowMs={nowMs}
              busy={cart.locking}
              showDetailLink={courtId === undefined}
            />
          ))}
        </div>
      )}

      <SelectionBar
        selectedCount={cart.selectedCount}
        selectedLabel={selectedLabel}
        heldCount={cart.heldCount}
        remainingMs={cart.lockExpiresAtMs && nowMs ? Math.max(0, cart.lockExpiresAtMs - nowMs) : 0}
        locking={cart.locking}
        onClear={cart.clearSelection}
        onLock={() => void handleLock()}
      />
    </div>
  );
}

function NetworkNotice({ error, onRetry }: { error: unknown; onRetry: () => Promise<void> }) {
  return (
    <AlertBanner
      tone="error"
      title="Không kết nối được tới server"
      action={
        <button type="button" onClick={() => void onRetry()} className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-500">
          Thử lại
        </button>
      }
      onDismiss={() => undefined}
    >
      {apiErrorMessage(error)}
    </AlertBanner>
  );
}
