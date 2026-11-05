'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { apiErrorMessage } from '@/lib/error-message';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(0\d{9,10}|\+84\d{9,10})$/;

interface FieldErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
}

export default function DangKyPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const patch = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Email chưa đúng định dạng.';
    if (!PHONE_PATTERN.test(form.phoneNumber.replace(/[\s.]/g, ''))) errors.phoneNumber = 'Số điện thoại phải có dạng 09xxxxxxxx hoặc +849xxxxxxxx.';
    if (form.password.length < 8) errors.password = 'Mật khẩu cần tối thiểu 8 ký tự.';
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signUp({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.replace(/[\s.]/g, ''),
        password: form.password,
      });
      router.replace('/san');
    } catch (caught) {
      setServerError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (invalid?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 ${
      invalid ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
    }`;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Tạo tài khoản khách hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Bạn chỉ cần đăng ký một lần để giữ chỗ và quản lý lịch đặt sân.</p>

        {serverError ? (
          <div className="mt-4">
            <AlertBanner tone="error" title="Đăng ký không thành công">
              {serverError}
            </AlertBanner>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
              Họ và tên
            </label>
            <input id="fullName" value={form.fullName} onChange={(event) => patch('fullName', event.target.value)} className={fieldClass(fieldErrors.fullName)} placeholder="Nguyễn Văn A" />
            {fieldErrors.fullName ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.fullName}</p> : null}
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => patch('email', event.target.value)} className={fieldClass(fieldErrors.email)} placeholder="ban@vidu.com" />
            {fieldErrors.email ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.email}</p> : null}
          </div>
          <div>
            <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-slate-700">
              Số điện thoại
            </label>
            <input id="phoneNumber" inputMode="tel" value={form.phoneNumber} onChange={(event) => patch('phoneNumber', event.target.value)} className={fieldClass(fieldErrors.phoneNumber)} placeholder="0912345678" />
            {fieldErrors.phoneNumber ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.phoneNumber}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Mật khẩu
              </label>
              <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => patch('password', event.target.value)} className={fieldClass(fieldErrors.password)} />
              {fieldErrors.password ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.password}</p> : null}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
                Nhập lại mật khẩu
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => patch('confirmPassword', event.target.value)}
                className={fieldClass(fieldErrors.confirmPassword)}
              />
              {fieldErrors.confirmPassword ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.confirmPassword}</p> : null}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <Spinner className="size-4" /> : null}
            {submitting ? 'Đang tạo tài khoản…' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-semibold text-brand-700 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
