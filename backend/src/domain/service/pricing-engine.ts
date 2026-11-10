import { DayType, PricingRule } from '../port/pricing.repository.port';

function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

// Rule cu the nhat thang: khop loai san > cua so gio hep > gia cao > ruleId nho (deterministic, tranh rule nen che rule cao diem).
function compareSpecificity(a: PricingRule, b: PricingRule): number {
  const typeRank = Number(b.courtType !== null) - Number(a.courtType !== null);
  if (typeRank !== 0) return typeRank;
  const widthA = toMinutes(a.endTime) - toMinutes(a.startTime);
  const widthB = toMinutes(b.endTime) - toMinutes(b.startTime);
  if (widthA !== widthB) return widthA - widthB;
  if (a.pricePerHour !== b.pricePerHour) return b.pricePerHour - a.pricePerHour;
  return a.ruleId - b.ruleId;
}

/** Chia thoi gian thanh tung khung 30 phut, moi khung chon rule cu the nhat roi cong lai. */
export function calculatePrice(
  rules: PricingRule[],
  dayType: DayType,
  courtType: string,
  startTime: string,
  endTime: string,
): number | null {
  const candidates = rules
    .filter((r) => r.dayType === dayType && (r.courtType === null || r.courtType === courtType))
    .sort(compareSpecificity);

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