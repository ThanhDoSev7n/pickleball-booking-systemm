'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { EmptyState } from '@/components/empty-state';
import { RequireAuth } from '@/components/require-auth';
import { LoadingBlock } from '@/components/spinner';
import { COURT_TYPE_LABELS, courtTypeLabel } from '@/lib/api/availability-api';
import {
  DAY_TYPE_LABELS,
  createCluster,
  createCourt,
  createPricingRule,
  deletePricingRule,
  setCourtActive,
  listMyClusters,
  listPricingRules,
  updateCourt,
  type DayType,
  type OwnerCluster,
  type PricingRule,
} from '@/lib/api/owner-api';
import { useAuth } from '@/lib/auth-context';
import { apiErrorMessage } from '@/lib/error-message';
import { OwnerDashboard } from '@/components/owner-dashboard';

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const btnClass = 'rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const COURT_TYPES = Object.keys(COURT_TYPE_LABELS);
const DAY_TYPES = Object.keys(DAY_TYPE_LABELS) as DayType[];
const STATUS_LABELS: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối' };

export default function ChuSanPage() {
  return (
    <RequireAuth title="Đăng nhập tài khoản chủ sân" description="Trang này dành cho chủ sân quản lý cụm sân và bảng giá.">
      <ChuSanView />
    </RequireAuth>
  );
}

function ChuSanView() {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<OwnerCluster[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      setClusters(await listMyClusters());
    } catch (caught) {
      setMessage({ tone: 'error', text: apiErrorMessage(caught) });
      setClusters([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Chay mot thao tac, bao ket qua, tai lai du lieu.
  const run = async (action: () => Promise<unknown>, okText: string): Promise<boolean> => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: okText });
      await reload();
      return true;
    } catch (caught) {
      setMessage({ tone: 'error', text: apiErrorMessage(caught) });
      return false;
    }
  };

  if (user && user.role !== 'OWNER') {
    return <AlertBanner tone="error">Chỉ chủ sân mới vào được trang này.</AlertBanner>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Quản lý sân</h1>
        <p className="mt-1 text-sm text-slate-500">Cụm sân, sân con và bảng giá theo khung giờ.</p>
      </header>
     < OwnerDashboard />
      <h2 className="pt-2 text-lg font-semibold text-slate-800">Quản lý sân và bảng giá</h2>
      {message ? (
        <AlertBanner tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </AlertBanner>
      ) : null}

      <NewClusterForm onSubmit={(p) => run(() => createCluster(p), 'Đã tạo cụm sân. Chờ Admin duyệt.')} />

      {clusters === null ? <LoadingBlock label="Đang tải cụm sân…" /> : null}
      {clusters?.length === 0 ? <EmptyState title="Chưa có cụm sân nào" description="Tạo cụm sân đầu tiên ở khung trên." /> : null}

      {clusters?.map((cluster) => (
        <ClusterCard key={cluster.clusterId} cluster={cluster} run={run} />
      ))}
    </div>
  );
}

type Run = (action: () => Promise<unknown>, okText: string) => Promise<boolean>;

function NewClusterForm({ onSubmit }: { onSubmit: (p: { name: string; address: string; city: string }) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
      <input className={inputClass} placeholder="Tên cụm sân" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputClass} placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} />
      <input className={inputClass} placeholder="Thành phố" value={city} onChange={(e) => setCity(e.target.value)} />
      <button
        type="button"
        className={btnClass}
        disabled={!name || !address || !city}
        onClick={async () => {
          await onSubmit({ name, address, city });
          setName('');
          setAddress('');
          setCity('');
        }}
      >
        Thêm cụm sân
      </button>
    </div>
  );
}

function ClusterCard({ cluster, run }: { cluster: OwnerCluster; run: Run }) {
  const [courtName, setCourtName] = useState('');
  const [courtType, setCourtType] = useState('OUTDOOR');
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [editingCourtName, setEditingCourtName] = useState('');
  const [editingCourtType, setEditingCourtType] = useState('OUTDOOR');
  const [rules, setRules] = useState<PricingRule[]>([]);

  const loadRules = useCallback(async () => {
    try {
      setRules(await listPricingRules(cluster.clusterId));
    } catch {
      setRules([]);
    }
  }, [cluster.clusterId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const runAndReloadRules: Run = async (action, okText) => {
    const succeeded = await run(action, okText);
    await loadRules();
    return succeeded;
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{cluster.name}</h2>
        <p className="text-sm text-slate-500">
          {cluster.address}, {cluster.city} · {STATUS_LABELS[cluster.status] ?? cluster.status}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Sân con</h3>
        <ul className="space-y-1 text-sm">
          {cluster.courts.map((court) => (
            <li key={court.courtId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              {editingCourtId === court.courtId ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    aria-label="Tên sân"
                    className={`${inputClass} sm:max-w-56`}
                    value={editingCourtName}
                    onChange={(event) => setEditingCourtName(event.target.value)}
                  />
                  <select
                    aria-label="Loại sân"
                    className={`${inputClass} sm:max-w-56`}
                    value={editingCourtType}
                    onChange={(event) => setEditingCourtType(event.target.value)}
                  >
                    {COURT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {courtTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={btnClass}
                    disabled={!editingCourtName.trim()}
                    onClick={async () => {
                      const saved = await run(
                        () => updateCourt(court.courtId, { name: editingCourtName.trim(), courtType: editingCourtType }),
                        'Đã cập nhật thông tin sân.',
                      );
                      if (saved) setEditingCourtId(null);
                    }}
                  >
                    Lưu
                  </button>
                  <button type="button" className="px-2 py-1 text-slate-600 hover:underline" onClick={() => setEditingCourtId(null)}>
                    Hủy
                  </button>
                </div>
              ) : (
                <>
                  <span className={Boolean(court.isActive) ? '' : 'text-slate-400 line-through'}>
                    {court.name} · {courtTypeLabel(court.courtType)}
                    {!Boolean(court.isActive) ? ' · Đã ẩn' : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-sky-700 hover:underline"
                      onClick={() => {
                        setEditingCourtId(court.courtId);
                        setEditingCourtName(court.name);
                        setEditingCourtType(court.courtType);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className={Boolean(court.isActive) ? 'text-red-600 hover:underline' : 'text-emerald-700 hover:underline'}
                      onClick={() =>
                        run(
                          () => setCourtActive(court.courtId, !Boolean(court.isActive)),
                          Boolean(court.isActive) ? 'Đã ẩn sân.' : 'Đã hiện lại sân.',
                        )
                      }
                    >
                      {Boolean(court.isActive) ? 'Ẩn' : 'Hiện lại'}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input className={inputClass} placeholder="Tên sân mới" value={courtName} onChange={(e) => setCourtName(e.target.value)} />
          <select className={inputClass} value={courtType} onChange={(e) => setCourtType(e.target.value)}>
            {COURT_TYPES.map((t) => (
              <option key={t} value={t}>
                {courtTypeLabel(t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnClass}
            disabled={!courtName}
            onClick={async () => {
              await run(() => createCourt(cluster.clusterId, { name: courtName, courtType }), 'Đã thêm sân.');
              setCourtName('');
            }}
          >
            Thêm sân
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Bảng giá (đồng/giờ)</h3>
        {rules.length === 0 ? <p className="text-sm text-slate-500">Chưa có bảng giá.</p> : null}
        <ul className="space-y-1 text-sm">
          {rules.map((rule) => (
            <li key={rule.ruleId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>
                {DAY_TYPE_LABELS[rule.dayType]} · {rule.startTime} - {rule.endTime} ·{' '}
                {rule.pricePerHour.toLocaleString('vi-VN')}đ
                {rule.courtType ? ` · ${courtTypeLabel(rule.courtType)}` : ' · Mọi loại sân'}
              </span>
              <button type="button" className="text-red-600 hover:underline" onClick={() => runAndReloadRules(() => deletePricingRule(rule.ruleId), 'Đã xoá bảng giá.')}>
                Xoá
              </button>
            </li>
          ))}
        </ul>
        <NewRuleForm onSubmit={(p) => runAndReloadRules(() => createPricingRule(cluster.clusterId, p), 'Đã thêm bảng giá.')} />
      </div>
    </section>
  );
}

function NewRuleForm({
  onSubmit,
}: {
  onSubmit: (p: { courtType?: string; dayType: DayType; startTime: string; endTime: string; pricePerHour: number }) => Promise<unknown>;
}) {
  const [dayType, setDayType] = useState<DayType>('WEEKDAY');
  const [courtType, setCourtType] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('17:00');
  const [price, setPrice] = useState(70000);

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-6">
      <select className={inputClass} value={dayType} onChange={(e) => setDayType(e.target.value as DayType)}>
        {DAY_TYPES.map((d) => (
          <option key={d} value={d}>
            {DAY_TYPE_LABELS[d]}
          </option>
        ))}
      </select>
      <select className={inputClass} value={courtType} onChange={(e) => setCourtType(e.target.value)}>
        <option value="">Mọi loại sân</option>
        {COURT_TYPES.map((t) => (
          <option key={t} value={t}>
            {courtTypeLabel(t)}
          </option>
        ))}
      </select>
      <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      <input type="number" min={1000} step={1000} className={inputClass} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      <button
        type="button"
        className={btnClass}
        onClick={() => onSubmit({ courtType: courtType || undefined, dayType, startTime, endTime, pricePerHour: price })}
      >
        Thêm giá
      </button>
    </div>
  );
}