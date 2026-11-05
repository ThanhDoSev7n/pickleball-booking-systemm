const VN_TZ = 'Asia/Ho_Chi_Minh';

const pad2 = (value: number) => String(value).padStart(2, '0');

type TimeInput = string | number | Date | null | undefined;

function toDate(value: TimeInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "18:00" theo gio Viet Nam. */
export function formatTime(value: TimeInput): string {
  const date = toDate(value);
  if (!date) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: VN_TZ,
  }).format(date);
}

/** "07/11/2026"; date-key "YYYY-MM-DD" giu nguyen, khong quy doi */
export function formatDate(value: TimeInput): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = toDate(value);
  if (!date) return '--/--/----';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VN_TZ,
  }).format(date);
}

const WEEKDAYS_VN = ['Chu nhat', 'Thu hai', 'Thu ba', 'Thu tu', 'Thu nam', 'Thu sau', 'Thu bay'];

/** "Thu ba, 07/11/2026". */
export function formatDateFull(value: TimeInput): string {
  const date = toDate(value);
  if (!date) return '--/--/----';
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VN_TZ,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick('weekday'));
  return `${WEEKDAYS_VN[weekdayIndex] ?? ''}, ${pick('day')}/${pick('month')}/${pick('year')}`;
}

/** "1.500.000 dong"; null/undefined -> null (chua co gia). */
export function formatVnd(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

/** Giay -> "mm:ss". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
}

/** "YYYY-MM-DD" cua hom nay (gio VN). */
export function todayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VN_TZ,
  }).formatToParts(new Date());
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Cong/tru ngay cho date-key, tra ve date-key. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}

/** khoang 00 -> 23, dung cho filter khung gio */
export function buildHourOptions(from = 6, to = 22): string[] {
  const options: string[] = [];
  for (let hour = from; hour <= to; hour += 1) options.push(`${pad2(hour)}:00`);
  return options;
}
