import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { OPERATIONAL_ROLES, UserRole } from '../../../domain/value-object/user-role.vo';
import { Paginated } from '../../../domain/port/booking.repository.port';
import { BookingView } from '../../../application/serialization/booking-view';
import { ConfirmBookingUseCase } from '../../../application/use-case/booking/confirm-booking.use-case';
import {
  BookingDetailView,
  CancelBookingUseCase,
  GetBookingDetailUseCase,
  GetMyBookingsUseCase,
} from '../../../application/use-case/booking/manage-bookings.use-case';
import { LockSlotsUseCase } from '../../../application/use-case/booking/lock-slots.use-case';
import { ReleaseSlotUseCase } from '../../../application/use-case/booking/release-slot.use-case';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import {
  BookingListQueryDto,
  CancelBookingDto,
  ConfirmBookingDto,
  LockSlotsDto,
} from '../dto/booking.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

const BOOKING_ROOM_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.STAFF,
  UserRole.OWNER,
  UserRole.ADMIN,
];

/** FR-02/FR-03/FR-04/FR-05: toan bo route dat san, chi goi use case. */
@Controller('api/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(
    private readonly lockSlots: LockSlotsUseCase,
    private readonly releaseSlot: ReleaseSlotUseCase,
    private readonly confirmBooking: ConfirmBookingUseCase,
    private readonly myBookings: GetMyBookingsUseCase,
    private readonly bookingDetail: GetBookingDetailUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
  ) {}

  @Post('lock')
  @Roles(...BOOKING_ROOM_ROLES)
  lock(@Body() dto: LockSlotsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lockSlots.execute({ slotIds: dto.slotIds, userId: user.userId });
  }

  @HttpCode(HttpStatus.OK)
  @Delete('lock/:slotId')
  @Roles(...BOOKING_ROOM_ROLES)
  release(@Param('slotId', ParseIntPipe) slotId: number, @CurrentUser() user: AuthenticatedUser) {
    return this.releaseSlot.execute({ slotId, userId: user.userId });
  }

  @Post('confirm')
  @Roles(...BOOKING_ROOM_ROLES)
  confirm(@Body() dto: ConfirmBookingDto, @CurrentUser() user: AuthenticatedUser): Promise<BookingView> {
    return this.confirmBooking.execute({
      slotIds: dto.slotIds,
      userId: user.userId,
      note: dto.note,
    });
  }

  // CUSTOMER duoc ke vi use case tu loc theo role: khach chi thay don cua minh (FR-05).
  @Get()
  @Roles(UserRole.CUSTOMER, ...OPERATIONAL_ROLES)
  list(
    @Query() query: BookingListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<BookingView>> {
    return this.myBookings.execute({
      requester: { userId: user.userId, role: user.role },
      clusterId: query.clusterId,
      courtId: query.courtId,
      status: query.status,
      from: query.from === undefined ? undefined : new Date(`${query.from}T00:00:00`),
      to: query.to === undefined ? undefined : new Date(`${query.to}T23:59:59`),
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, ...OPERATIONAL_ROLES)
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BookingDetailView> {
    return this.bookingDetail.execute(id, { userId: user.userId, role: user.role });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  @Roles(UserRole.CUSTOMER, ...OPERATIONAL_ROLES)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BookingView> {
    return this.cancelBooking.execute(id, { userId: user.userId, role: user.role }, dto.reason);
  }
}
