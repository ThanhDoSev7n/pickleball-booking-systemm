import { Inject, Injectable } from '@nestjs/common';
import { toDateString } from '../../../domain/model/booking-slot.entity';
import {
  DayType,
  IPricingRepository,
  PRICING_REPOSITORY,
  PricingRule,
} from '../../../domain/port/pricing.repository.port';
import {
  IStatsRepository,
  RevenueBookingRow,
  STATS_REPOSITORY,
} from '../../../domain/port/stats.repository.port';
import { calculatePrice } from '../../../domain/service/pricing-engine';

export type StatsRange = 'today' | '7days' | 'month';

export interface OwnerStats {
  range: StatsRange;
  from: string;
  to: string;
  totalRevenue: number;
  bookingCount: number;
  totalHours: number;
  /** Phan tram 0-100 */
  occupancyRate: number;
  revenueByDay: { date: string; revenue: number }[];
  revenueByCourt: { courtId: number; courtName: string; revenue: number }[];
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** Thong ke doanh thu cho chu san: today = hom nay, 7days = 7 ngay gan nhat, month = tu ngay 1 den hom nay. */
@Injectable()
export class OwnerStatsUseCase {
  constructor(
    @Inject(STATS_REPOSITORY) private readonly stats: IStatsRepository,
    @Inject(PRICING_REPOSITORY) private readonly pricing: IPricingRepository,
  ) {}

  async execute(ownerId: number | null, range: StatsRange): Promise<OwnerStats> {
    const today = new Date();
    const fromDate =
      range === 'today'
        ? today
        : range === '7days'
          ? addDays(today, -6)
          : new Date(today.getFullYear(), today.getMonth(), 1);
    const from = toDateString(fromDate);
    const to = toDateString(today);

    const days: string[] = [];
    for (let d = new Date(fromDate); toDateString(d) <= to; d = addDays(d, 1)) {
      days.push(toDateString(d));
    }

    const [bookings, courts] = await Promise.all([
      this.stats.findRevenueBookings(ownerId, from, to),
      this.stats.findOwnerCourts(ownerId),
    ]);

    const rulesCache = new Map<number, PricingRule[]>();
    const holidayCache = new Map<string, boolean>();
    const byDay = new Map<string, number>(days.map((d) => [d, 0]));
    const byCourt = new Map<number, number>(courts.map((c) => [c.courtId, 0]));
    let totalRevenue = 0;
    let totalHours = 0;

    for (const booking of bookings) {
      const amount = booking.totalAmount ?? (await this.estimate(booking, rulesCache, holidayCache));
      totalRevenue += amount;
      totalHours += (toMinutes(booking.endTime) - toMinutes(booking.startTime)) / 60;
      byDay.set(booking.date, (byDay.get(booking.date) ?? 0) + amount);
      byCourt.set(booking.courtId, (byCourt.get(booking.courtId) ?? 0) + amount);
    }

    const dailyHours = courts.reduce(
      (sum, c) => sum + (toMinutes(c.closingTime) - toMinutes(c.openingTime)) / 60,
      0,
    );
    const availableHours = dailyHours * days.length;
    const occupancyRate =
      availableHours > 0 ? Math.min(100, Math.round((totalHours / availableHours) * 1000) / 10) : 0;

    return {
      range,
      from,
      to,
      totalRevenue,
      bookingCount: bookings.length,
      totalHours,
      occupancyRate,
      revenueByDay: days.map((date) => ({ date, revenue: byDay.get(date) ?? 0 })),
      revenueByCourt: courts
        .map((c) => ({ courtId: c.courtId, courtName: c.courtName, revenue: byCourt.get(c.courtId) ?? 0 }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  /** Booking chua co total_amount thi tinh tu bang gia (Pricing Engine). */
  private async estimate(
    booking: RevenueBookingRow,
    rulesCache: Map<number, PricingRule[]>,
    holidayCache: Map<string, boolean>,
  ): Promise<number> {
    let rules = rulesCache.get(booking.clusterId);
    if (rules === undefined) {
      rules = await this.pricing.findRules(booking.clusterId);
      rulesCache.set(booking.clusterId, rules);
    }
    let holiday = holidayCache.get(booking.date);
    if (holiday === undefined) {
      holiday = await this.pricing.isHoliday(booking.date);
      holidayCache.set(booking.date, holiday);
    }
    const weekday = new Date(`${booking.date}T00:00:00`).getDay();
    const dayType: DayType = holiday ? 'HOLIDAY' : weekday === 0 || weekday === 6 ? 'WEEKEND' : 'WEEKDAY';
    return calculatePrice(rules, dayType, booking.courtType, booking.startTime, booking.endTime) ?? 0;
  }
}