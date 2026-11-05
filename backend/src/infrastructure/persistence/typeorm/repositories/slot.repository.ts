import { Injectable } from '@nestjs/common';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import { BookingSlot, toDateString } from '../../../../domain/model/booking-slot.entity';
import {
  ISlotRepository,
  SlotQueryFilter,
} from '../../../../domain/port/slot.repository.port';
import { TransactionHandle } from '../../../../domain/port/transaction.port';
import { SlotStatus } from '../../../../domain/value-object/slot-status.vo';
import { CourtType } from '../../../../domain/value-object/court-type.vo';
import { CourtSchema } from '../entities/court.schema';
import { BookingSlotSchema } from '../entities/booking-slot.schema';
import { blankSlotRow, toDomainSlot, toSchemaSlot } from '../entity-mapper';
import { TypeOrmTransactionManager } from '../typeorm-transaction.manager';

interface CourtScheduleRow {
  courtId: number;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
}

@Injectable()
export class TypeOrmSlotRepository implements ISlotRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: TypeOrmTransactionManager,
  ) {}

  /**
   * STEP 2 cua thuat toan 4.7.1 — SELECT ... FOR UPDATE.
   * InnoDB record lock (next-key lock o REPEATABLE READ) dam bao chi mot transaction
   * cap duoc dong nay. Cac transaction khong chay rong cho toi innodb_lock_wait_timeout.
   */
  async findForUpdate(tx: TransactionHandle, slotId: number): Promise<BookingSlot | null> {
    const entityManager = this.transactions.resolve(tx);
    const row = await entityManager
      .createQueryBuilder(BookingSlotSchema, 'slot')
      .setLock('pessimistic_write')
      .where('slot.slot_id = :slotId', { slotId })
      .getOne();
    return row ? toDomainSlot(row) : null;
  }

  async findById(
    tx: TransactionHandle | null,
    slotId: number,
  ): Promise<BookingSlot | null> {
    const row = await this.transactions.resolve(tx).findOne(BookingSlotSchema, {
      where: { slotId },
    });
    return row ? toDomainSlot(row) : null;
  }

  async findByIds(
    tx: TransactionHandle | null,
    slotIds: number[],
  ): Promise<BookingSlot[]> {
    if (slotIds.length === 0) {
      return [];
    }
    const rows = await this.transactions.resolve(tx).find(BookingSlotSchema, {
      where: { slotId: In(slotIds) },
      order: { startTime: 'ASC' },
    });
    return rows.map(toDomainSlot);
  }

  async findByBookingId(bookingId: number): Promise<BookingSlot[]> {
    const rows = await this.dataSource.manager.find(BookingSlotSchema, {
      where: { bookingId },
      order: { startTime: 'ASC' },
    });
    return rows.map(toDomainSlot);
  }

  async save(tx: TransactionHandle, slot: BookingSlot): Promise<BookingSlot> {
    const entityManager = this.transactions.resolve(tx);
    const existing = slot.slotId
      ? await entityManager.findOne(BookingSlotSchema, { where: { slotId: slot.slotId } })
      : null;
    const row = toSchemaSlot(slot, existing ?? blankSlotRow());
    const saved = await entityManager.save(BookingSlotSchema, row);
    return toDomainSlot(saved);
  }

  async saveMany(tx: TransactionHandle, slots: BookingSlot[]): Promise<BookingSlot[]> {
    const saved: BookingSlot[] = [];
    for (const slot of slots) {
      saved.push(await this.save(tx, slot));
    }
    return saved;
  }

  async search(filter: SlotQueryFilter, now: Date): Promise<BookingSlot[]> {
    const qb = this.dataSource
      .createQueryBuilder(BookingSlotSchema, 'slot')
      .innerJoin('slot.court', 'court')
      .innerJoin('court.cluster', 'cluster')
      .where('slot.slot_date = :date', { date: filter.date })
      // Chi hien thi san cua cum da duoc Admin duyet (FR-15) va san con hoat dong.
      .andWhere('cluster.status = :approvedStatus', { approvedStatus: 'APPROVED' })
      .andWhere('cluster.is_active = 1')
      .andWhere('court.is_active = 1')
      .andWhere('slot.status IN (:...statuses)', {
        statuses: [SlotStatus.AVAILABLE, SlotStatus.LOCKED],
      })
      // Lazy release (muc 4.7.1): giu cho qua han duoc hien thi nhu khung gio trong.
      .andWhere(
        '(slot.lock_expires_at IS NULL OR slot.lock_expires_at > :now OR slot.locked_by IS NULL)',
        { now },
      )
      .orderBy('court.cluster_id', 'ASC')
      .addOrderBy('slot.court_id', 'ASC')
      .addOrderBy('slot.start_time', 'ASC')
      // limit() thay vi take(): take() sinh subquery DISTINCT, khi sort theo cot cua bang join
      // thi TypeORM loi "Cannot read properties of undefined (reading 'databaseName')".
      .limit(600);

    applyOptionalFilters(qb, filter);
    const rows = await qb.getMany();
    return rows.map(toDomainSlot);
  }

  async listByCourtAndRange(courtId: number, from: Date, to: Date): Promise<BookingSlot[]> {
    const rows = await this.dataSource.manager
      .createQueryBuilder(BookingSlotSchema, 'slot')
      .where('slot.court_id = :courtId', { courtId })
      .andWhere('slot.start_time >= :from', { from })
      .andWhere('slot.start_time <= :to', { to })
      .orderBy('slot.start_time', 'ASC')
      .getMany();
    return rows.map(toDomainSlot);
  }

  /**
   * Cron body (muc 4.7.1):
   * UPDATE booking_slots SET status='AVAILABLE', locked_by=NULL, lock_expires_at=NULL
   *  WHERE status='LOCKED' AND lock_expires_at < NOW()
   */
  async releaseExpiredLocks(now: Date): Promise<number> {
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .update(BookingSlotSchema)
      .set({
        status: SlotStatus.AVAILABLE,
        lockedBy: null,
        lockExpiresAt: null,
      })
      .where('status = :status', { status: SlotStatus.LOCKED })
      .andWhere('lock_expires_at IS NOT NULL')
      .andWhere('lock_expires_at < :now', { now })
      .execute();
    return result.affected ?? 0;
  }

  async findByStatusOlderThan(status: SlotStatus, cutoff: Date): Promise<BookingSlot[]> {
    const rows = await this.dataSource.manager
      .createQueryBuilder(BookingSlotSchema, 'slot')
      .where('slot.status = :status', { status })
      .andWhere('slot.start_time < :cutoff', { cutoff })
      .getMany();
    return rows.map(toDomainSlot);
  }

  async countByStatusForDate(date: string): Promise<Record<SlotStatus, number>> {
    const raw = await this.dataSource
      .createQueryBuilder(BookingSlotSchema, 'slot')
      .select('slot.status', 'status')
      .addSelect('COUNT(1)', 'total')
      .where('slot.slot_date = :date', { date })
      .groupBy('slot.status')
      .getRawMany<{ status: SlotStatus; total: string }>();

    const counts: Record<SlotStatus, number> = {
      [SlotStatus.AVAILABLE]: 0,
      [SlotStatus.LOCKED]: 0,
      [SlotStatus.BOOKED]: 0,
      [SlotStatus.BLOCKED]: 0,
    };
    for (const row of raw) {
      counts[row.status] = Number(row.total);
    }
    return counts;
  }

  /**
   * Tao slot trong ngay cho cac san (idempotent).
   * INSERT IGNORE dua vao uk_booking_slots_court_start de khong tao trung khi goi lap lai.
   * Day la du lieu nen cua Thanh vien 2 (gio mo cua/san) duoc Booking Context dung den.
   */
  async ensureSlotsExist(courtIds: number[], date: string): Promise<number> {
    if (courtIds.length === 0) {
      return 0;
    }
    const courts = await this.dataSource
      .createQueryBuilder(CourtSchema, 'court')
      .select('court.court_id', 'courtId')
      .addSelect('court.opening_time', 'openingTime')
      .addSelect('court.closing_time', 'closingTime')
      .addSelect('court.slot_duration_minutes', 'slotDurationMinutes')
      .where('court.court_id IN (:...courtIds)', { courtIds })
      .andWhere('court.is_active = 1')
      .getRawMany<CourtScheduleRow>();

    const values: string[] = [];
    const params: (string | number)[] = [];
    for (const court of courts) {
      const duration = normalizeDuration(court.slotDurationMinutes);
      for (const [startIso, endIso] of buildSlotWindows(date, court.openingTime, court.closingTime, duration)) {
        values.push('(?, ?, ?, ?)');
        params.push(court.courtId, date, startIso, endIso);
      }
    }
    if (values.length === 0) {
      return 0;
    }
    const result = await this.dataSource.query(
      // Khong ghi cot status: DEFAULT 'AVAILABLE' cua schema loai lech 4/5 gia tri trai nguoc.
      `INSERT IGNORE INTO booking_slots (court_id, slot_date, start_time, end_time)
       VALUES ${values.join(', ')}`,
      params,
    );
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }
}

function applyOptionalFilters(
  qb: SelectQueryBuilder<BookingSlotSchema>,
  filter: SlotQueryFilter,
): void {
  if (filter.courtId !== undefined) {
    qb.andWhere('slot.court_id = :courtId', { courtId: filter.courtId });
  }
  if (filter.clusterId !== undefined) {
    qb.andWhere('cluster.cluster_id = :clusterId', { clusterId: filter.clusterId });
  }
  if (filter.courtType !== undefined) {
    qb.andWhere('court.court_type = :courtType', { courtType: filter.courtType as CourtType });
  }
  if (filter.city !== undefined) {
    qb.andWhere('cluster.city = :city', { city: filter.city });
  }
  if (filter.timeFrom !== undefined) {
    qb.andWhere('TIME(slot.start_time) >= :timeFrom', { timeFrom: filter.timeFrom });
  }
  if (filter.timeTo !== undefined) {
    qb.andWhere('TIME(slot.end_time) <= :timeTo', { timeTo: filter.timeTo });
  }
}

const ALLOWED_DURATIONS = [30, 60, 90];

function normalizeDuration(value: number | string): number {
  const duration = Number(value);
  return ALLOWED_DURATIONS.includes(duration) ? duration : 60;
}

/** Duoc database/seed.ts tai su dung de sinh slot 14 ngay. */
export function buildSlotWindows(
  date: Stringable,
  openingTime: string,
  closingTime: string,
  durationMinutes: number,
): Array<[string, string]> {
  const windows: Array<[string, string]> = [];
  let cursor = combineDateTime(date, openingTime);
  const dayEnd = combineDateTime(date, closingTime);
  while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const next = new Date(cursor.getTime() + durationMinutes * 60_000);
    windows.push([toMysqlDateTime(cursor), toMysqlDateTime(next)]);
    cursor = next;
  }
  return windows;
}

type Stringable = string | Date;

export function combineDateTime(date: Stringable, time: string): Date {
  const datePart = typeof date === 'string' ? date : toDateString(date);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm = 0, ss = 0] = time.split(':').map(Number);
  // Dung local Date constructor: MySQL DATETIME khong mang timezone, nen ca 2 phia
  // (slot generation va doc/ghi) deu tinh theo gio may/chuoi cung mot moc.
  return new Date(y, m - 1, d, hh, mm, ss);
}

/** MySQL DATETIME duoi dang 'YYYY-MM-DD HH:MM:SS' — tranh timezone khi truyen raw query. */
export function toMysqlDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

