'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { BookingCartProvider } from '@/lib/booking-cart-context';
import { Navbar } from './navbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BookingCartProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-4">
            <p className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6">
              Hệ thống đặt sân Pickleball · Đồ án Nhập môn CNPM · Frontend chạy tại cổng 3001, API backend tại cổng 3000
            </p>
          </footer>
        </div>
      </BookingCartProvider>
    </AuthProvider>
  );
}
