'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/alert-banner';
import { BookingSummary, PRICE_PENDING_MESSAGE } from '@/components/booking-summary';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CountdownTimer } from '@/components/countdown-timer';
import { EmptyState } from '@/components/empty-state';
import { QrCode } from '@/components/qr-code';
import { RequireAuth } from '@/components/require-auth';
import { Spinner } from '@/components/spinner';
import { courtTypeLabel } from '@/lib/api/availability-api';
import { formatDate, formatTime } from '@/lib/format';
import { apiErrorMessage, isLockExpiredError, isSlotTakenError } from '@/lib/error-message';
import { useBookingCart } from '@/lib/booking-cart-context';

export default function DatChongPage() {
  return (
    <RequireAuth title="Đăng nhập để giữ chỗ" description="Bạn cần đăng nhập để khóa giữ chỗ và xác nhận đặt sân.">
      <DatChongView />
    </RequireAuth>
  );
}

function DatChongView() {
  const cart = useBookingCart();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissedSignal, setDismissedSignal] = useState(0);
  const [askConfirm, setAskConfirm] = useState(false);

  // Context tu tang expirySignal khi giu cho het han / bi xa -> suy ra trang thai, khong can effect
  const expired = !cart.lastConfirmed && cart.heldCount === 0 && cart.expirySignal > dismissedSignal;

  const dismissExpired = () => {
    setDismissedSignal(cart.expirySignal);
    setError(null);
  };

  const handleConfirm = async () => {
    setError(null);
    const outcome = await cart.confirm(note);
    setAskConfirm(false);
    if (!outcome.ok) {
      const message = apiErrorMessage(outcome.error);
      setError(message);
      // Slot mat giu cho / bi nguoi khac cat -> phai xu lai tu dau
      if (isLockExpiredError(outcome.error) || isSlotTakenError(outcome.error)) await cart.releaseAll();
    }
  };

  if (cart.lastConfirmed) {
    const booking = cart.lastConfirmed;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <AlertBanner tone="success" title="Đặt sân thành công">
          Mã đặt sân của bạn là <span className="font-mono font-bold">{booking.bookingCode}</span>. Hãy đến trước giờ chơi 10 phút và đưa mã QR cho lễ tân.
        </AlertBanner>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2 text-sm text-slate-600">
              <p className="text-lg font-bold text-slate-800">{booking.bookingCode}</p>
              <p>
                {formatDate(booking.startTime)} · {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              </p>
              <p>
                {booking.slots?.length ?? 0} khung giờ · Trạng thái: <span className="font-medium">{booking.status}</span>
              </p>
              <p className="pt-2">
                {booking.totalAmount !== null && booking.totalAmount !== undefined ? (
                  <span className="font-semibold text-brand-700">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(booking.totalAmount)}</span>
                ) : (
                  <span className="italic text-slate-500">{PRICE_PENDING_MESSAGE}</span>
                )}
              </p>
              <ul className="space-y-1 pt-1 text-xs text-slate-500">
                {booking.slots?.map((slot) => (
                  <li key={slot.slotId}>
                    Slot #{slot.slotId}
                    {slot.startTime ? ` · ${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
            <QrCode value={booking.qrCode ?? booking.bookingCode} caption="QR check-in tại quầy" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lich-dat" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Xem lịch sử đặt sân
          </Link>
          <Link
            href="/san"
            onClick={() => cart.dismissConfirmed()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Đặt sân khác
          </Link>
        </div>
      </div>
    );
  }

  if (!cart.heldCount) {
    return (
      <div className="space-y-5">
        <Header />
        <EmptyState
          title="Chưa có khung giờ nào đang giữ chỗ"
          description="Vào trang Tra cứu sân, chọn khung giờ còn trống rồi bấm “Giữ chỗ 5 phút”. Trạng thái giữ chỗ sẽ hiển thị tại đây."
          action={
            <Link href="/san" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Đi tra cứu sân
            </Link>
          }
        />
        {cart.selectedCount ? (
          <AlertBanner tone="info" title="Đã chọn khung giờ nhưng chưa giữ chỗ">
            Bạn đang chọn {cart.selectedCount} khung giờ. Về trang Tra cứu sân để bấm “Giữ chỗ 5 phút” và bắt đầu đếm ngược.
            <div className="mt-2">
              <Link href="/san" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
                Về trang tra cứu
              </Link>
            </div>
          </AlertBanner>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />

      {expired ? (
        <AlertBanner tone="warning" title="Không còn khung giờ đang giữ chỗ" onDismiss={dismissExpired}>
          Thời gian 5 phút đã kết thúc hoặc bạn vừa bỏ giữ chỗ — các khung giờ đã được mở lại cho người khác.
          <div className="mt-2">
            <button type="button" onClick={() => router.push('/san')} className="rounded-lg bg-warn-500 px-3 py-1.5 text-xs font-semibold text-white">
              Chọn khung giờ khác
            </button>
          </div>
        </AlertBanner>
      ) : null}

      {error ? (
        <AlertBanner tone="error" title="Xác nhận đặt sân thất bại" onDismiss={() => setError(null)}>
          {error}
        </AlertBanner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Khung giờ đang giữ chỗ ({cart.heldCount})</h2>
              <button
                type="button"
                onClick={() => void cart.releaseAll()}
                disabled={cart.releasing}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {cart.releasing ? 'Đang bỏ…' : 'Bỏ toàn bộ giữ chỗ'}
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {cart.held.map((slot) => (
                <li key={slot.slotId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                      <span className="ml-2 text-xs font-normal text-slate-500">{formatDate(slot.startTime)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {slot.courtName} · {courtTypeLabel(slot.courtType)} · {slot.clusterName} ({slot.city})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void cart.releaseOne(slot.slotId)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Bỏ giữ
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Slot đang bị khóa bởi tài khoản của bạn — người khác không thể chọn. Hết 5 phút hệ thống tự động mở lại.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <label htmlFor="note" className="mb-1 block text-sm font-semibold text-slate-800">
              Ghi chú cho lễ tân <span className="font-normal text-xs text-slate-500">(không bắt buộc)</span>
            </label>
            <textarea
              id="note"
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Ví dụ: nhóm 4 người, cần thuê thêm bóng."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{note.length}/200</p>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <CountdownTimer expiresAtMs={cart.lockExpiresAtMs} totalMs={cart.ttlMs} />
          <BookingSummary slots={cart.held} title={`${cart.heldCount} khung giờ giữ chỗ`} totalAmount={null} note={note || undefined} />
          <button
            type="button"
            onClick={() => setAskConfirm(true)}
            disabled={cart.confirming}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {cart.confirming ? <Spinner className="size-4" /> : null}
            {cart.confirming ? 'Đang xác nhận…' : 'Xác nhận đặt sân'}
          </button>
          <p className="text-center text-xs text-slate-500">Xác nhận trước khi hết đếm ngược để giữ đúng khung giờ đã chọn.</p>
        </aside>
      </div>

      <ConfirmDialog
        open={askConfirm}
        title="Xác nhận đặt sân?"
        confirmLabel={cart.confirming ? 'Đang xử lý…' : 'Xác nhận đặt'}
        busy={cart.confirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setAskConfirm(false)}
      >
        <p>
          Bạn sắp đặt {cart.heldCount} khung giờ tại {cart.held[0]?.courtName} ({cart.held[0]?.clusterName}).
        </p>
        <p className="italic text-slate-500">{PRICE_PENDING_MESSAGE}.</p>
        <p>Sau khi xác nhận, hệ thống trả về mã đặt sân và mã QR check-in.</p>
      </ConfirmDialog>
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Đặt chông</h1>
      <p className="mt-1 text-sm text-slate-500">Đây là các khung giờ bạn đang khóa giữ chỗ. Hoàn tất xác nhận trước khi hết 5 phút.</p>
    </header>
  );
}
