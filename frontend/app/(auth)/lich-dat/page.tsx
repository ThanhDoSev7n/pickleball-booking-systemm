'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { BookingHistoryItem } from '@/components/booking-history-item';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock, Spinner } from '@/components/spinner';
import { RequireAuth } from '@/components/require-auth';
import { cancelBooking, listBookings, type BookingDetail } from '@/lib/api/booking-api';
import { apiErrorMessage } from '@/lib/error-message';
import { usePolling } from '@/lib/use-polling';

const PAGE_SIZE = 10;

export default function LichDatPage() {
  return (
    <RequireAuth title="Đăng nhập để xem lịch sử" description="Lịch sử đặt sân chỉ hiển thị với tài khoản đã đăng nhập.">
      <LichDatView />
    </RequireAuth>
  );
}

function LichDatView() {
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<BookingDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data, error, loading, refreshing, refresh } = usePolling(() => listBookings(page, PAGE_SIZE), {
    intervalMs: 60_000,
    deps: [page],
  });

  const handleCancel = async () => {
    if (!target) return;
    setBusy(true);
    setMessage(null);
    try {
      await cancelBooking(target.bookingId);
      setMessage({ tone: 'success', text: `Đã hủy lịch đặt ${target.bookingCode}. Khung giờ đã được mở lại.` });
      setTarget(null);
      await refresh();
    } catch (caught) {
      setMessage({ tone: 'error', text: apiErrorMessage(caught) });
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Lịch sử đặt sân</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi mã đặt sân, mã QR check-in và hủy lịch khi cần đổi kế hoạch.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {refreshing ? <Spinner className="size-4 text-brand-600" /> : null}
            Làm mới
          </button>
          <Link href="/san" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Đặt thêm sân
          </Link>
        </div>
      </header>

      {message ? (
        <AlertBanner tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </AlertBanner>
      ) : null}

      {loading ? <LoadingBlock label="Đang tải lịch sử đặt sân…" /> : null}

      {!loading && error && !data ? (
        <AlertBanner
          tone="error"
          title="Không tải được lịch sử đặt sân"
          action={
            <button type="button" onClick={() => void refresh()} className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white">
              Thử lại
            </button>
          }
        >
          {apiErrorMessage(error)}
        </AlertBanner>
      ) : null}

      {!loading && data && !data.items.length ? (
        <EmptyState
          title="Chưa có lịch đặt sân nào"
          description="Khi bạn xác nhận đặt sân thành công, mã đặt và mã QR check-in sẽ xuất hiện tại đây."
          action={
            <Link href="/san" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Tìm sân ngay
            </Link>
          }
        />
      ) : null}

      {!loading && data?.items.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {data.items.map((booking) => (
              <BookingHistoryItem key={booking.bookingId} booking={booking} onCancel={setTarget} busy={busy} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Trang trước
            </button>
            <span>
              Trang {data.page} / {totalPages} · {data.total} lịch đặt
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(target)}
        title="Hủy lịch đặt sân?"
        confirmLabel={busy ? 'Đang hủy…' : 'Hủy lịch đặt'}
        tone="danger"
        busy={busy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setTarget(null)}
      >
        <p>
          Lịch đặt <span className="font-mono font-semibold">{target?.bookingCode}</span> sẽ bị hủy và khung giờ được mở lại cho người khác.
        </p>
        <p className="italic text-slate-500">Thao tác này không thể hoàn lại.</p>
      </ConfirmDialog>
    </div>
  );
}
