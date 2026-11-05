import { apiClient } from './client';

export type SlotAvailability = 'AVAILABLE' | 'HELD';

export interface SlotView {
  slotId: number;
  courtId: number;
  startTime: string;
  endTime: string;
  availability: SlotAvailability;
  holdRemainingSeconds: number;
}

export interface CourtAvailability {
  courtId: number;
  courtName: string;
  courtType: string;
  clusterId: number;
  clusterName: string;
  city: string;
  availableCount: number;
  slots: SlotView[];
}

export interface AvailabilityResult {
  date: string;
  courts: CourtAvailability[];
}

export interface AvailabilityQuery {
  date: string;
  city?: string;
  courtType?: string;
  clusterId?: number;
  courtId?: number;
  timeFrom?: string;
  timeTo?: string;
}

export interface UiSlot extends SlotView {
  /** Moc thoi gian diem mat giu cho (ms), tinh tai thoi diem nhan duoc response */
  holdExpiresAtMs: number | null;
}

export interface UiCourt extends Omit<CourtAvailability, 'slots'> {
  slots: UiSlot[];
}

export const COURT_TYPE_LABELS: Record<string, string> = {
  OUTDOOR: 'Ngoài trời',
  INDOOR: 'Trong nhà',
  COMPETITION: 'Sân thi đấu',
};

export const COURT_TYPE_OPTIONS = Object.keys(COURT_TYPE_LABELS);

export function courtTypeLabel(courtType: string): string {
  return COURT_TYPE_LABELS[courtType] ?? courtType;
}

/** Backend co the tra { date, courts } hoac mang cua san - cho ca 2 shape. */
function normalize(raw: unknown, fallbackDate: string): AvailabilityResult {
  if (Array.isArray(raw)) return { date: fallbackDate, courts: raw as CourtAvailability[] };
  const object = raw as Partial<AvailabilityResult> | null;
  const courts = Array.isArray(object?.courts) ? object!.courts : [];
  return { date: object?.date ?? fallbackDate, courts };
}

export async function fetchAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
  const params: Record<string, string | number> = { date: query.date };
  if (query.city) params.city = query.city;
  if (query.courtType) params.courtType = query.courtType;
  if (query.clusterId !== undefined) params.clusterId = query.clusterId;
  if (query.courtId !== undefined) params.courtId = query.courtId;
  if (query.timeFrom) params.timeFrom = query.timeFrom;
  if (query.timeTo) params.timeTo = query.timeTo;

  const { data } = await apiClient.get<AvailabilityResult>('/availability', { params });
  return normalize(data, query.date);
}

export function decorateCourts(result: AvailabilityResult, fetchedAtMs = Date.now()): UiCourt[] {
  return result.courts.map((court) => ({
    ...court,
    slots: [...court.slots]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map<UiSlot>((slot) => ({
        ...slot,
        holdExpiresAtMs:
          slot.availability === 'HELD' && slot.holdRemainingSeconds > 0
            ? fetchedAtMs + slot.holdRemainingSeconds * 1000
            : null,
      })),
  }));
}
