'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { apiErrorMessage } from '@/lib/error-message';
import { useBookingCart } from '@/lib/booking-cart-context';

export default function DangNhapPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, user } = useAuth();
  const { selectedCount, heldCount } = useBookingCart();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Da dang nhap thi khong can o trang nay nua
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role === 'OWNER') {
      router.replace('/chu-san');
    } else {
      router.replace(selectedCount || heldCount ? '/dat-chong' : '/san');
    }
  }, [isAuthenticated, router, selectedCount, heldCount, user?.role]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Bạn hãy nhập đầy đủ email và mật khẩu.');
      return;
    }
    setSubmitting(true);
    try {
      const signedInUser = await signIn(email.trim(), password);

      if (signedInUser.role === 'OWNER') {
        router.replace('/chu-san');
      } else {
        router.replace(selectedCount || heldCount ? '/dat-chong' : '/san');
      }
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Đăng nhập</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user ? `Xin chào ${user.fullName}.` : 'Đăng nhập để giữ chỗ và xác nhận đặt sân.'}
        </p>

        {error ? (
          <div className="mt-4">
            <AlertBanner tone="error" title="Đăng nhập không thành công">
              {error}
            </AlertBanner>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ban@vidu.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-16 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <Spinner className="size-4" /> : null}
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <Link href="/dang-ky" className="font-semibold text-brand-700 hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
      <p className="text-center text-xs text-slate-500">
        Cần xem sân trống trước?{' '}
        <Link href="/san" className="font-medium text-brand-700 hover:underline">
          Tra cứu sân
        </Link>
      </p>
    </div>
  );
}
