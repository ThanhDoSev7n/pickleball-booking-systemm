import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode, ForbiddenError } from '../../../domain/error/domain.error';
import { BookingSlot } from '../../../domain/model/booking-slot.entity';
import { Booking } from '../../../domain/model/booking.entity';
import { CourtCluster } from '../../../domain/model/court.entity';
import {
  BOOKING_REPOSITORY,
  BookingListQuery,
  IBookingRepository,
  Paginated,
} from '../../../domain/port/booking.repository.port';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import { SLOT_REPOSITORY, ISlotRepository } from '../../../domain/port/slot.repository.port';
import { TRANSACTION_MANAGER, ITransactionManager } from '../../../domain/port/transaction.port';
import { BookingStatus } from '../../../domain/value-object/booking-status.vo';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { SlotStatus } from '../../../domain/value-object/slot-status.vo';
import { BookingView, toBookingView } from '../../serialization/booking-view';

export const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_CANCEL_REASON = 'User tu huy';

/** Danh dan duoc middleware/guard dua ra tu access token. */
export interface Requester {
  userId: number;
  role: UserRole;
}

export interface BookingListInput {
  requester: Requester;
  clusterId?: number;
  courtId?: number;
  status?: BookingStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface BookingSlotView {
  slotId: number;
  courtId: number;
  startTime: string;
  endTime: string;
  status: SlotStatus;
}

export interface BookingDetailView extends BookingView {
  slots: BookingSlotView[];
}

/**
 * FR-05/FR-04: xem danh sach, xem chi tiet va huy don dat.
 * Phan quyen (muc 4.7.3): CUSTOMER chi thay don cua minh; STAFF/OWNER thay theo cum san
 * ho quan ly; ADMIN thay toan bo.
 */
@Injectable()
export class GetMyBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: IBookingRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  async execute(input: BookingListInput): Promise<Paginated<BookingView>> {
    const scope = await resolveScope(this.courts, input.requester, input.clusterId);
    const query: BookingListQuery = {
      ...scope,
      courtId: input.courtId,
      status: input.status,
      from: input.from,
      to: input.to,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
    };
    const result = await this.bookings.list(query);
    return { ...result, items: result.items.map((booking) => toBookingView(booking)) };
  }
}

@Injectable()
export class GetBookingDetailUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: IBookingRepository,
    @Inject(SLOT_REPOSITORY) private readonly slots: ISlotRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
  ) {}

  async execute(bookingId: number, requester: Requester): Promise<BookingDetailView> {
    const booking = await this.findOrThrow(bookingId);
    if (requester.role !== UserRole.ADMIN && !booking.isOwnedBy(requester.userId)) {
      // Role van hanh chi duoc xem don thuoc cum san cua ho (muc 4.7.3).
      const visible = await visibleClusterIds(this.courts, requester);
      if (!visible.includes(booking.clusterId)) {
        throw new ForbiddenError('Don dat khong thuoc pham vi quan ly cua ban', {
          bookingId,
          clusterId: booking.clusterId,
        });
      }
    }
    const slots = await this.slots.findByBookingId(booking.bookingId);
    return { ...toBookingView(booking, slots.map((slot) => slot.slotId)), slots: slots.map(toSlotView) };
  }

  private async findOrThrow(bookingId: number): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === null) {
      throw new DomainError(
        DomainErrorCode.BOOKING_NOT_FOUND,
        `Don dat ${bookingId} khong ton tai`,
        { bookingId },
      );
    }
    return booking;
  }
}

@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: IBookingRepository,
    @Inject(SLOT_REPOSITORY) private readonly slots: ISlotRepository,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: ITransactionManager,
  ) {}

  async execute(
    bookingId: number,
    requester: Requester,
    reason?: string,
  ): Promise<BookingView> {
    const now = new Date();
    const booking = await this.findOrThrow(bookingId);
    if (requester.role !== UserRole.ADMIN && !booking.isOwnedBy(requester.userId)) {
      const visible = await visibleClusterIds(this.courts, requester);
      if (!visible.includes(booking.clusterId)) {
        throw new ForbiddenError('Ban khong du quyen huy don dat nay', { bookingId });
      }
    }
    // NEM loi truoc khi mo transaction: kiem tra khong can doc/ghi them.
    booking.cancel(reason ?? DEFAULT_CANCEL_REASON, now);

    // Doc slot ngoai transaction de giu thoi gian mo khoa ngan (muc 4.1.3).
    const slots = await this.slots.findByBookingId(booking.bookingId);
    const persisted = await this.transactions.runInTransaction(async (tx) => {
      const saved = await this.bookings.save(tx, booking);
      // FR-04: hoan slot ve AVAILABLE de nguoi khac dat lai duoc.
      for (const slot of slots) {
        if (slot.status === SlotStatus.BOOKED && slot.bookingId === booking.bookingId) {
          slot.markReleasedFromBooking();
          await this.slots.save(tx, slot);
        }
      }
      return saved;
    });

    return toBookingView(persisted, slots.map((slot) => slot.slotId));
  }

  private async findOrThrow(bookingId: number): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === null) {
      throw new DomainError(
        DomainErrorCode.BOOKING_NOT_FOUND,
        `Don dat ${bookingId} khong ton tai`,
        { bookingId },
      );
    }
    return booking;
  }
}

/**
 * Tu so `court_clusters.owner_id` de xac dinh pham vi.
 * STAFF chua co bang phan cong staff-cluster (bang nay le thuoc Court Context - Thanh vien 2),
 * nen pham vi cua STAFF la cac cum da duoc Admin duyet.
 */
async function visibleClusterIds(courts: ICourtRepository, requester: Requester): Promise<number[]> {
  if (requester.role === UserRole.ADMIN) {
    return [];
  }
  const clusters = await courts.findClusters({ bookableOnly: false });
  if (requester.role === UserRole.OWNER) {
    return clusters.filter(byOwner(requester.userId)).map((cluster) => cluster.clusterId);
  }
  if (requester.role === UserRole.STAFF) {
    return clusters.filter((cluster) => cluster.isBookable()).map((cluster) => cluster.clusterId);
  }
  return [];
}

function byOwner(userId: number): (cluster: CourtCluster) => boolean {
  return (cluster) => cluster.ownerId === userId;
}

/** Chuyen role requester thanh bo loc SQL; tung loi som khi pham vi khong du 1 cum san. */
async function resolveScope(
  courts: ICourtRepository,
  requester: Requester,
  requestedClusterId?: number,
): Promise<Pick<BookingListQuery, 'userId' | 'clusterId'>> {
  if (requester.role === UserRole.CUSTOMER) {
    return { userId: requester.userId, clusterId: requestedClusterId };
  }
  if (requester.role === UserRole.ADMIN) {
    return { clusterId: requestedClusterId };
  }

  const visible = await visibleClusterIds(courts, requester);
  if (requestedClusterId !== undefined) {
    if (!visible.includes(requestedClusterId)) {
      throw new ForbiddenError('Cum san khong thuoc pham vi quan ly cua ban', {
        clusterId: requestedClusterId,
      });
    }
    return { clusterId: requestedClusterId };
  }
  if (visible.length === 1) {
    return { clusterId: visible[0] };
  }
  // List() chi loc duoc 1 clusterId nen nhieu cum san thi bat buoc chon cum.
  throw new ForbiddenError(
    'Tai khoan quan ly nhieu cum san, vui long gui kem clusterId',
    { visibleClusterIds: visible },
  );
}

function toSlotView(slot: BookingSlot): BookingSlotView {
  return {
    slotId: slot.slotId,
    courtId: slot.courtId,
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
    status: slot.status,
  };
}
