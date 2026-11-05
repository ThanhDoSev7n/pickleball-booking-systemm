'use client';

import { useEffect, useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { LoadingBlock } from '@/components/spinner';
import { fetchOwnerStats, type OwnerStats, type StatsRange } from '@/lib/api/owner-api';
import { apiErrorMessage } from '@/lib/error-message';

const RANGES: { value: StatsRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày' },
  { value: 'month', label: 'Tháng này' },
];

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

export function OwnerDashboard() {
  const [range, setRange] = useState<StatsRange>('7days');
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignored = false;
    setLoading(true);
    setError(null);
    fetchOwnerStats(range)
      .then((data) => {
        if (!ignored) setStats(data);
      })
      .catch((caught) => {
        if (!ignored) setError(apiErrorMessage(caught));
      })
      .finally(() => {
        if (!ignored) setLoading(false);
      });
    return () => {
      ignored = true;
    };
  }, [range]);

  const maxDay = Math.max(1, ...(stats?.revenueByDay.map((d) => d.revenue) ?? [1]));
  const maxCourt = Math.max(1, ...(stats?.revenueByCourt.map((c) => c.revenue) ?? [1]));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Thống kê doanh thu</h2>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                range === r.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}
      {loading && !stats ? <LoadingBlock label="Đang tải thống kê…" /> : null}

      {stats ? (
        <div className={loading ? 'space-y-4 opacity-60' : 'space-y-4'}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tổng doanh thu" value={money(stats.totalRevenue)} />
            <StatCard label="Số lượt đặt sân" value={String(stats.bookingCount)} />
            <StatCard label="Tổng giờ thuê sân" value={`${stats.totalHours} giờ`} />
            <StatCard label="Tỷ lệ lấp đầy" value={`${stats.occupancyRate}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Doanh thu theo ngày</h3>
              <div className="flex gap-1">
                {stats.revenueByDay.map((d) => (
                  <div
                    key={d.date}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                    title={`${d.date}: ${money(d.revenue)}`}
                  >
                    <div className="flex h-44 w-full items-end justify-center">
                      <div
                        className="w-full max-w-12 rounded-t bg-brand-600"
                        style={{ height: `${(d.revenue / maxDay) * 100}%`, minHeight: d.revenue > 0 ? 2 : 0 }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">Số dưới mỗi cột là ngày trong tháng. Rê chuột vào cột để xem số tiền.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Doanh thu theo sân</h3>
              {stats.revenueByCourt.length === 0 ? <p className="text-sm text-slate-500">Chưa có sân nào.</p> : null}
              <ul className="space-y-3">
                {stats.revenueByCourt.map((c) => (
                  <li key={c.courtId}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{c.courtName}</span>
                      <span className="font-medium text-slate-800">{money(c.revenue)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-brand-600" style={{ width: `${(c.revenue / maxCourt) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}