'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { RequireAuth } from '@/components/require-auth';
import { LoadingBlock } from '@/components/spinner';
import { apiErrorMessage } from '@/lib/error-message';
import { useAuth } from '@/lib/auth-context';
import { fetchAdminClusters, fetchAdminStats, fetchAdminUsers, decideAdminCluster, setAdminUserActive, setAdminUserRole, type AdminCluster, type AdminUser } from '@/lib/api/admin-api';
import type { OwnerStats, StatsRange } from '@/lib/api/owner-api';

const roles: AdminUser['role'][] = ['CUSTOMER', 'STAFF', 'OWNER', 'ADMIN'];
const ranges: { id: StatsRange; label: string }[] = [{ id: 'today', label: 'Hôm nay' }, { id: '7days', label: '7 ngày' }, { id: 'month', label: 'Tháng này' }];
const money = (v: number) => `${v.toLocaleString('vi-VN')}đ`;

export default function AdminPage() {
  const { user, status } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [range, setRange] = useState<StatsRange>('7days');
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clusters, setClusters] = useState<AdminCluster[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  const reload = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true); setError('');
    try {
      const [s, u, c] = await Promise.all([fetchAdminStats(range), fetchAdminUsers(), fetchAdminClusters()]);
      setStats(s); setUsers(u); setClusters(c);
    } catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  }, [isAdmin, range]);
  useEffect(() => { if (!isAdmin) return; const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer); }, [isAdmin, reload]);
  useEffect(() => { if (!isAdmin) return; const timer = window.setInterval(() => void reload(), 30_000); return () => window.clearInterval(timer); }, [isAdmin, reload]);

  const pending = clusters.filter((c) => c.status === 'PENDING');
  if (status === 'loading') return <LoadingBlock label="Đang xác thực…" />;
  if (!user) return <RequireAuth title="Đăng nhập tài khoản Admin" description="Dashboard này chỉ dành cho quản trị viên hệ thống.">{null}</RequireAuth>;
  if (!isAdmin) return <AlertBanner tone="error">Trang này chỉ dành cho quản trị viên.</AlertBanner>;
  const act = async (task: () => Promise<unknown>) => { try { await task(); await reload(); } catch (e) { setError(apiErrorMessage(e)); } };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-brand-700">QUẢN TRỊ HỆ THỐNG</p><h1 className="text-3xl font-bold text-slate-900">Tổng quan Admin</h1><p className="mt-1 text-slate-500">Doanh thu, công suất sân và quản lý vận hành toàn hệ thống.</p></div><button onClick={() => void reload()} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Làm mới</button></header>
    {error && <AlertBanner tone="error">{error}</AlertBanner>}
    <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Báo cáo toàn hệ thống</h2><div className="flex gap-2">{ranges.map((r) => <button key={r.id} onClick={() => setRange(r.id)} className={`rounded-full border px-3 py-1.5 text-sm ${range === r.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'text-slate-600'}`}>{r.label}</button>)}</div></div>
      {busy && !stats ? <LoadingBlock label="Đang tải báo cáo…" /> : stats && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Doanh thu" value={money(stats.totalRevenue)} /><Metric label="Lượt đặt hợp lệ" value={String(stats.bookingCount)} /><Metric label="Giờ sân đã đặt" value={`${stats.totalHours} giờ`} /><Metric label="Tỷ lệ lấp đầy" value={`${stats.occupancyRate}%`} /></div><div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="mb-3 text-sm font-semibold">Doanh thu theo ngày</h3><div className="flex h-44 items-end gap-2">{stats.revenueByDay.map(d => <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${money(d.revenue)}`}><div className="w-full max-w-16 rounded-t bg-brand-600" style={{ height: `${Math.max(d.revenue ? 3 : 0, d.revenue / Math.max(1, ...stats.revenueByDay.map(x => x.revenue)) * 80)}%` }} /><span className="text-[10px] text-slate-500">{d.date.slice(8)}</span></div>)}</div></div></>}
    </section>
    <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Duyệt đăng ký cụm sân</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Chờ duyệt: {pending.length}</span></div>{pending.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Không có đăng ký đang chờ.</p> : <div className="divide-y">{pending.map(c => <article key={c.clusterId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{c.name}</h3><p className="text-sm text-slate-500">{c.address}, {c.city} · Chủ sân #{c.ownerId} · {c.courts?.length ?? 0} sân con</p></div><div className="flex gap-2"><button onClick={() => void act(() => decideAdminCluster(c.clusterId, 'REJECTED'))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Từ chối</button><button onClick={() => void act(() => decideAdminCluster(c.clusterId, 'APPROVED'))} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Duyệt cụm sân</button></div></article>)}</div>}</section>
    <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Quản lý tài khoản</h2><span className="text-sm text-slate-500">{users.length} tài khoản</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Tài khoản</th><th>Điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th className="text-right">Thao tác</th></tr></thead><tbody className="divide-y">{users.map(u => <tr key={u.userId}><td className="py-3"><p className="font-semibold">{u.fullName}</p><p className="text-xs text-slate-500">{u.email}</p></td><td>{u.phoneNumber}</td><td><select aria-label={`Vai trò ${u.fullName}`} value={u.role} disabled={u.userId === user.userId} onChange={e => void act(() => setAdminUserRole(u.userId, e.target.value as AdminUser['role']))} className="rounded-lg border px-2 py-1">{roles.map(role => <option key={role}>{role}</option>)}</select></td><td><span className={Boolean(u.isActive) ? 'text-emerald-700' : 'text-slate-400'}>{Boolean(u.isActive) ? 'Đang hoạt động' : 'Đã khóa'}</span></td><td className="text-right"><button disabled={u.userId === user.userId} onClick={() => void act(() => setAdminUserActive(u.userId, !Boolean(u.isActive)))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{Boolean(u.isActive) ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table></div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>; }
