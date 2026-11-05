import { DayType, PricingRule } from '../port/pricing.repository.port';

function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** Chia thoi gian thanh tung khung 30 phut, moi khung tim bang gia phu hop roi cong lai. */
export function calculatePrice(
  rules: PricingRule[],
  dayType: DayType,
  courtType: string,
  startTime: string,
  endTime: string,
): number | null {
  // Rule rieng cho loai san duoc uu tien truoc rule ap dung moi loai san.
  const candidates = rules
    .filter((r) => r.dayType === dayType && (r.courtType === null || r.courtType === courtType))
    .sort((a, b) => Number(b.courtType !== null) - Number(a.courtType !== null));

  let total = 0;
  for (let t = toMinutes(startTime); t < toMinutes(endTime); t += 30) {
    const rule = candidates.find((r) => toMinutes(r.startTime) <= t && t < toMinutes(r.endTime));
    if (rule === undefined) {
      return null;
    }
    total += rule.pricePerHour / 2;
  }
  return total;
}