'use client';

import { COURT_TYPE_LABELS, COURT_TYPE_OPTIONS, type AvailabilityQuery } from '@/lib/api/availability-api';
import { buildHourOptions, formatDateFull, shiftDateKey, todayKey } from '@/lib/format';

export interface AvailabilityFilterProps {
  query: AvailabilityQuery;
  cityOptions: string[];
  onChange: (patch: Partial<AvailabilityQuery>) => void;
  onReset: () => void;
  disabled?: boolean;
}

const HOURS = buildHourOptions(6, 22);

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function AvailabilityFilter({ query, cityOptions, onChange, onReset, disabled = false }: AvailabilityFilterProps) {
  const date = query.date;
  const invalidRange = Boolean(query.timeFrom && query.timeTo && query.timeFrom > query.timeTo);
  const noDate = !date;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ date: shiftDateKey(date, -1) })}
          disabled={noDate}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ← Ngày trước
        </button>
        <input
          type="date"
          value={date}
          min={query.date || undefined}
          onChange={(event) => onChange({ date: event.target.value })}
          className={FIELD + ' w-auto'}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => onChange({ date: shiftDateKey(date, 1) })}
          disabled={noDate}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Ngày sau →
        </button>
        <button
          type="button"
          onClick={() => onChange({ date: todayKey() })}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Hôm nay
        </button>
        <p className="ml-auto text-sm font-medium text-slate-600">{formatDateFull(date)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="city">
            Thành phố / Khu vực
          </label>
          <input
            id="city"
            list="city-options"
            value={query.city ?? ''}
            placeholder="Ví dụ: Ha Noi"
            onChange={(event) => onChange({ city: event.target.value })}
            className={FIELD}
            disabled={disabled}
          />
          <datalist id="city-options">
            {cityOptions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={LABEL} htmlFor="courtType">
            Loại sân
          </label>
          <select
            id="courtType"
            value={query.courtType ?? ''}
            onChange={(event) => onChange({ courtType: event.target.value })}
            className={FIELD}
            disabled={disabled}
          >
            <option value="">Tất cả loại sân</option>
            {COURT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {COURT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="timeFrom">
            Từ khung giờ
          </label>
          <select
            id="timeFrom"
            value={query.timeFrom ?? ''}
            onChange={(event) => onChange({ timeFrom: event.target.value })}
            className={FIELD}
            disabled={disabled}
          >
            <option value="">Mở cửa (06:00)</option>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="timeTo">
            Đến khung giờ
          </label>
          <select
            id="timeTo"
            value={query.timeTo ?? ''}
            onChange={(event) => onChange({ timeTo: event.target.value })}
            className={FIELD}
            disabled={disabled}
          >
            <option value="">Đóng cửa (22:00)</option>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Xóa bộ lọc
        </button>
        <p className="text-xs text-slate-500">Lọc theo khoảng giờ: chọn khung bắt đầu và kết thúc (ví dụ 18:00 → 20:00).</p>
        {invalidRange ? <p className="text-xs font-medium text-danger-600">Khung giờ bắt đầu phải nhỏ hơn khung giờ kết thúc.</p> : null}
      </div>
    </div>
  );
}
