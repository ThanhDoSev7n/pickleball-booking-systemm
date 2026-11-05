import { BookingSlot } from '../../../domain/model/booking-slot.entity';
import { Booking } from '../../../domain/model/booking.entity';
import { User } from '../../../domain/model/user.entity';
import { Court, CourtCluster } from '../../../domain/model/court.entity';
import { BookingSlotSchema } from './entities/booking-slot.schema';
import { BookingSchema } from './entities/booking.schema';
import { CourtSchema } from './entities/court.schema';
import { CourtClusterSchema } from './entities/court-cluster.schema';
import { UserSchema } from './entities/user.schema';

/**
 * Mapper giua ORM row (infrastructure) va domain entity (domain) - Dependency Inversion, muc 4.5.1.
 * Domain entity duoc tai tao qua Object.assign de giu phuong thuc hanh vi.
 */
function hydrate<T extends object>(target: T, source: Partial<T>): T {
  return Object.assign(target, source);
}

export function toDomainSlot(row: BookingSlotSchema): BookingSlot {
  return hydrate(new BookingSlot(), {
    slotId: row.slotId,
    courtId: row.courtId,
    slotDate: typeof row.slotDate === 'string' ? row.slotDate : String(row.slotDate),
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    lockedBy: row.lockedBy,
    lockExpiresAt: row.lockExpiresAt,
    bookingId: row.bookingId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toSchemaSlot(slot: BookingSlot, row: BookingSlotSchema): BookingSlotSchema {
  row.slotId = slot.slotId;
  row.courtId = slot.courtId;
  row.slotDate = slot.slotDate;
  row.startTime = slot.startTime;
  row.endTime = slot.endTime;
  row.status = slot.status;
  row.lockedBy = slot.lockedBy;
  row.lockExpiresAt = slot.lockExpiresAt;
  row.bookingId = slot.bookingId;
  return row;
}

export function blankSlotRow(): BookingSlotSchema {
  return new BookingSlotSchema();
}

export function toDomainBooking(row: BookingSchema): Booking {
  return hydrate(new Booking(), {
    bookingId: row.bookingId,
    bookingCode: row.bookingCode,
    qrCode: row.qrCode,
    userId: row.userId,
    courtId: row.courtId,
    clusterId: row.clusterId,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
    slotIds: [],
    note: row.note,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toSchemaBooking(booking: Booking, row: BookingSchema): BookingSchema {
  row.bookingCode = booking.bookingCode;
  row.qrCode = booking.qrCode;
  row.userId = booking.userId;
  row.courtId = booking.courtId;
  row.clusterId = booking.clusterId;
  row.startTime = booking.startTime;
  row.endTime = booking.endTime;
  row.status = booking.status;
  row.totalAmount = booking.totalAmount === null ? null : String(booking.totalAmount);
  row.currency = 'VND';
  row.note = booking.note;
  row.cancelledAt = booking.cancelledAt;
  row.cancelReason = booking.cancelReason;
  return row;
}

export function blankBookingRow(): BookingSchema {
  return new BookingSchema();
}

export function toDomainUser(row: UserSchema): User {
  return hydrate(new User(), {
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: Boolean(row.isActive),
    refreshTokenHash: row.refreshTokenHash ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toSchemaUser(user: User, row: UserSchema): UserSchema {
  row.fullName = user.fullName;
  row.email = user.email;
  row.phoneNumber = user.phoneNumber;
  row.passwordHash = user.passwordHash;
  row.role = user.role;
  row.isActive = user.isActive;
  row.refreshTokenHash = user.refreshTokenHash;
  return row;
}

export function blankUserRow(): UserSchema {
  return new UserSchema();
}

export function toDomainCourt(row: CourtSchema): Court {
  const court = new Court();
  court.courtId = row.courtId;
  court.clusterId = row.clusterId;
  court.name = row.name;
  court.courtType = row.courtType;
  court.isActive = row.isActive;
  court.openingTime = row.openingTime;
  court.closingTime = row.closingTime;
  court.slotDurationMinutes = row.slotDurationMinutes;
  court.clusterName = row.cluster?.name ?? '';
  court.city = row.cluster?.city ?? '';
  return court;
}

export function toDomainCluster(row: CourtClusterSchema, courts: Court[] = []): CourtCluster {
  const cluster = new CourtCluster();
  cluster.clusterId = row.clusterId;
  cluster.name = row.name;
  cluster.address = row.address;
  cluster.city = row.city;
  cluster.ownerId = row.ownerId;
  cluster.status = row.status;
  cluster.isActive = row.isActive;
  cluster.courts = courts;
  return cluster;
}
