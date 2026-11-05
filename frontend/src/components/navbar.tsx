'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/api/auth-api';
import { useBookingCart } from '@/lib/booking-cart-context';

const LINKS = [
  { href: '/chu-san', label: 'Dashboard' },
  { href: '/san', label: 'Tìm sân' },
  { href: '/dat-chong', label: 'Đặt chông' },
  { href: '/lich-dat', label: 'Lịch đặt' },
  { href: '/ghep-keo', label: 'Ghép kèo' },
  
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const { heldCount, selectedCount } = useBookingCart();
  const [open, setOpen] = useState(false);
  const cartBadge = heldCount + selectedCount;
      const links =
    user?.role === 'OWNER' ? [...LINKS, { href: '/chu-san', label: 'Dashboard' }] : LINKS;

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/san" className="flex items-center gap-2 font-bold text-slate-800">
          <Image
            src="/logo.png"
            alt="Logo Pick Hub"
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 object-contain"
          />
          <span className="hidden sm:inline">
            Đặt Sân <span className="text-brand-700">Pickleball</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
              {link.href === '/dat-chong' && cartBadge > 0 ? (
                <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{cartBadge}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/dang-nhap" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Đăng ký
              </Link>
            </div>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-300 p-2 text-slate-700 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Mở menu"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)} onClick={() => setOpen(false)}>
                {link.label}
                {link.href === '/dat-chong' && cartBadge > 0 ? (
                  <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{cartBadge}</span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/dang-nhap" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>
                  Đăng nhập
                </Link>
                <Link href="/dang-ky" className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
