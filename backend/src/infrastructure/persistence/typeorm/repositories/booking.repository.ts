import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../../../../domain/model/booking.entity';
import {
  BookingListQuery,
  IBookingRepository,
  Paginated,
} from '../../../../domain/port/booking.repository.port';
import { TransactionHandle } from '../../../../domain/port/transaction.port';
import { BookingStatus } from '../../../../domain/value-object/booking-status.vo';
import { BookingSchema } from '../entities/booking.schema';
import { blankBookingRow, toDomainBooking, toSchemaBooking } from '../entity-mapper';
import { TypeOrmTransactionManager } from '../typeorm-transaction.manager';

@Injectable()
export class TypeOrmBookingRepository implements IBookingRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: TypeOrmTransactionManager,
  ) {}

  async save(tx: TransactionHandle, booking: Booking): Promise<Booking> {
    const entityManager = this.transactions.resolve(tx);
    // toSchemaBooking khong copy bookingId: phai nap row cu de save() chay UPDATE,
    // neu khong thi moi lan huy/doi trang thai lai INSERT va trung uk_bookings_booking_code.
    const existing = booking.bookingId
      ? await entityManager.findOne(BookingSchema, { where: { bookingId: booking.bookingId } })
      : null;
    const row = toSchemaBooking(booking, existing ?? blankBookingRow());
    const saved = await entityManager.save(BookingSchema, row);
    return toDomainBooking(saved);
  }

  async findById(bookingId: number): Promise<Booking | null> {
    const row = await this.dataSource.manager.findOne(BookingSchema, { where: { bookingId } });
    return row ? toDomainBooking(row) : null;
  }

  async findByCode(bookingCode: string): Promise<Booking | null> {
    const row = await this.dataSource.manager.findOne(BookingSchema, { where: { bookingCode } });
    return row ? toDomainBooking(row) : null;
  }

  async existsByCode(bookingCode: string): Promise<boolean> {
    return this.dataSource.manager.exists(BookingSchema, { where: { bookingCode } });
  }

  async list(query: BookingListQuery): Promise<Paginated<Booking>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const qb = this.dataSource.createQueryBuilder(BookingSchema, 'booking');

    if (query.userId !== undefined) {
      qb.andWhere('booking.user_id = :userId', { userId: query.userId });
    }
    if (query.clusterId !== undefined) {
      qb.andWhere('booking.cluster_id = :clusterId', { clusterId: query.clusterId });
    }
    if (query.courtId !== undefined) {
      qb.andWhere('booking.court_id = :courtId', { courtId: query.courtId });
    }
    if (query.status !== undefined) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }
    if (query.from !== undefined) {
      qb.andWhere('booking.end_time >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      qb.andWhere('booking.start_time <= :to', { to: query.to });
    }

    const [rows, total] = await qb
      .orderBy('booking.start_time', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items: rows.map(toDomainBooking), total, page, pageSize };
  }

  async updateStatus(bookingId: number, status: BookingStatus): Promise<void> {
    await this.dataSource.manager.update(BookingSchema, { bookingId }, { status });
  }
}
