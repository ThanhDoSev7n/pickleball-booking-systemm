export const STATS_REPOSITORY = 'STATS_REPOSITORY';

export interface RevenueBookingRow {
  bookingId: number;
  courtId: number;
  clusterId: number;
  courtType: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number | null;
}

export interface OwnerCourtRow {
  courtId: number;
  courtName: string;
  openingTime: string;
  closingTime: string;
}

export interface IStatsRepository {
  findRevenueBookings(ownerId: number | null, from: string, to: string): Promise<RevenueBookingRow[]>;
  findOwnerCourts(ownerId: number | null): Promise<OwnerCourtRow[]>;
}