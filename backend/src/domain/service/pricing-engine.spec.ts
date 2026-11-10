import { DayType, PricingRule } from '../port/pricing.repository.port';
import { calculatePrice } from './pricing-engine';

function makeRule(p: {
  start: string;
  end: string;
  price: number;
  courtType?: string | null;
  dayType?: DayType;
  ruleId?: number;
}): PricingRule {
  return {
    ruleId: p.ruleId ?? 1,
    clusterId: 1,
    courtType: p.courtType ?? null,
    dayType: p.dayType ?? 'WEEKDAY',
    startTime: p.start,
    endTime: p.end,
    pricePerHour: p.price,
  };
}

const BASE = makeRule({ start: '06:00', end: '22:00', price: 100_000, ruleId: 1 });
const PEAK = makeRule({ start: '17:00', end: '21:00', price: 200_000, ruleId: 2 });

describe('calculatePrice - uu tien rule cu the nhat (fix #3)', () => {
  it('Rule cao diem cua so hep thang rule nen ca ngay: 18:00-19:00 ra 200k chu khong 100k', () => {
    expect(calculatePrice([BASE, PEAK], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(200_000);
  });

  it('Ngoai gio cao diem thi ap dung rule nen: 10:00-11:00 ra 100k', () => {
    expect(calculatePrice([BASE, PEAK], 'WEEKDAY', 'OUTDOOR', '10:00', '11:00')).toBe(100_000);
  });

  it('Booking vat qua nhieu cua so: 16:00-18:00 = 100k nen + 200k cao diem = 300k', () => {
    expect(calculatePrice([BASE, PEAK], 'WEEKDAY', 'OUTDOOR', '16:00', '18:00')).toBe(300_000);
  });

  it('Cua so hep nhat thang khi nhieu rule chong nhau: super-peak 18:00-19:00 @300k', () => {
    const superPeak = makeRule({ start: '18:00', end: '19:00', price: 300_000, ruleId: 3 });
    expect(calculatePrice([BASE, PEAK, superPeak], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(300_000);
  });

  it('Ket qua deterministic khong phu thuoc thu tu mang trong query', () => {
    expect(calculatePrice([BASE, PEAK], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(200_000);
    expect(calculatePrice([PEAK, BASE], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(200_000);
  });

  it('Tiebreak cua so bang nhau: gia cao hon thang, khong dua vao thu tu', () => {
    const a = makeRule({ start: '16:00', end: '20:00', price: 100_000, ruleId: 1 });
    const b = makeRule({ start: '18:00', end: '22:00', price: 200_000, ruleId: 2 });
    expect(calculatePrice([a, b], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(200_000);
    expect(calculatePrice([b, a], 'WEEKDAY', 'OUTDOOR', '18:00', '19:00')).toBe(200_000);
  });

  it('Rule theo loai san thang rule chung: INDOOR 150k vs generic 100k', () => {
    const indoor = makeRule({ start: '06:00', end: '22:00', price: 150_000, courtType: 'INDOOR', ruleId: 2 });
    expect(calculatePrice([BASE, indoor], 'WEEKDAY', 'INDOOR', '10:00', '11:00')).toBe(150_000);
  });

  it('Rule loai san khac khong ap dung: OUTDOOR chi thay generic 100k', () => {
    const indoor = makeRule({ start: '06:00', end: '22:00', price: 150_000, courtType: 'INDOOR', ruleId: 2 });
    expect(calculatePrice([BASE, indoor], 'WEEKDAY', 'OUTDOOR', '10:00', '11:00')).toBe(100_000);
  });

  it('Loc theo dayType: WEEKEND dung rule 150k, WEEKDAY dung rule 100k', () => {
    const weekend = makeRule({ start: '06:00', end: '22:00', price: 150_000, dayType: 'WEEKEND', ruleId: 2 });
    expect(calculatePrice([BASE, weekend], 'WEEKEND', 'OUTDOOR', '10:00', '11:00')).toBe(150_000);
    expect(calculatePrice([BASE, weekend], 'WEEKDAY', 'OUTDOOR', '10:00', '11:00')).toBe(100_000);
  });

  it('Khong co rule phu khung gio -> null', () => {
    const morning = makeRule({ start: '06:00', end: '12:00', price: 100_000 });
    expect(calculatePrice([morning], 'WEEKDAY', 'OUTDOOR', '13:00', '14:00')).toBeNull();
  });

  it('Khong co rule nao -> null', () => {
    expect(calculatePrice([], 'WEEKDAY', 'OUTDOOR', '10:00', '11:00')).toBeNull();
  });
});