'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LoadingBlock } from './spinner';

export interface RequireAuthProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function RequireAuth({ children, title = 'Bạn cần đăng nhập', description = 'Tính năng này chỉ dành cho khách hàng đã đăng ký tài khoản.' }: RequireAuthProps) {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <LoadingBlock label="Đang kiểm tra phiên đăng nhập…" />;
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/dang-nhap"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Đăng nhập
          </Link>
          <Link
            href="/dang-ky"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tạo tài khoản
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
