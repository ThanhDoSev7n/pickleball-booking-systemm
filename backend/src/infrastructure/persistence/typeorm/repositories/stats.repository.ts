import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  IStatsRepository,
  OwnerCourtRow,
  RevenueBookingRow,
} from '../../../../domain/port/stats.repository.port';

@Injectable()
export class TypeOrmStatsRepository implements IStatsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findRevenueBookings(ownerId: number, from: string, to: string): Promise<RevenueBookingRow[]> {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT b.booking_id AS bookingId, b.court_id AS courtId, b.cluster_id AS clusterId,
              c.court_type AS courtType,
              DATE_FORMAT(b.start_time, '%Y-%m-%d') AS date,
              TIME_FORMAT(b.start_time, '%H:%i') AS startTime,
              TIME_FORMAT(b.end_time, '%H:%i') AS endTime,
              b.total_amount AS totalAmount
       FROM bookings b
       INNER JOIN courts c ON c.court_id = b.court_id
       INNER JOIN court_clusters cl ON cl.cluster_id = b.cluster_id
       WHERE cl.owner_id = ?
         AND b.status IN ('CONFIRMED', 'PAID', 'CHECKED_IN', 'COMPLETED')
         AND DATE(b.start_time) BETWEEN ? AND ?`,
      [ownerId, from, to],
    );
    return rows.map((r) => ({
      bookingId: Number(r.bookingId),
      courtId: Number(r.courtId),
      clusterId: Number(r.clusterId),
      courtType: String(r.courtType),
      date: String(r.date),
      startTime: String(r.startTime),
      endTime: String(r.endTime),
      totalAmount: r.totalAmount === null ? null : Number(r.totalAmount),
    }));
  }

  async findOwnerCourts(ownerId: number): Promise<OwnerCourtRow[]> {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT c.court_id AS courtId, c.name AS courtName,
              TIME_FORMAT(c.opening_time, '%H:%i') AS openingTime,
              TIME_FORMAT(c.closing_time, '%H:%i') AS closingTime
       FROM courts c
       INNER JOIN court_clusters cl ON cl.cluster_id = c.cluster_id
       WHERE cl.owner_id = ? AND c.is_active = 1 AND cl.is_active = 1
       ORDER BY c.court_id`,
      [ownerId],
    );
    return rows.map((r) => ({
      courtId: Number(r.courtId),
      courtName: String(r.courtName),
      openingTime: String(r.openingTime),
      closingTime: String(r.closingTime),
    }));
  }
}