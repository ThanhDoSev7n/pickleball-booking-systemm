import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import { ConfirmBookingUseCase } from '../booking/confirm-booking.use-case';
import { LockSlotsUseCase } from '../booking/lock-slots.use-case';
import { BookingStatus } from '../../../domain/value-object/booking-status.vo';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { AuthenticatedUser } from '../../../presentation/http/decorators/current-user.decorator';
import { BookingSchema } from '../../../infrastructure/persistence/typeorm/entities/booking.schema';
import { CheckInSchema } from '../../../infrastructure/persistence/typeorm/entities/check-in.schema';
import { UserSchema } from '../../../infrastructure/persistence/typeorm/entities/user.schema';
import { normalizePhone } from '../../../domain/model/user.entity';
import { PosInvoiceItemSchema, PosInvoiceSchema } from '../../../infrastructure/persistence/typeorm/entities/pos-invoice.schema';
import { ServiceSchema } from '../../../infrastructure/persistence/typeorm/entities/service.schema';
import { toBookingView } from '../../serialization/booking-view';
import { toDomainBooking, toSchemaBooking } from '../../../infrastructure/persistence/typeorm/entity-mapper';
import { Inject } from '@nestjs/common';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import { ISlotRepository, SLOT_REPOSITORY } from '../../../domain/port/slot.repository.port';
import { QuotePriceUseCase } from '../pricing/pricing.use-case';

const OPS_ROLES = [UserRole.STAFF, UserRole.OWNER, UserRole.ADMIN];

@Injectable()
export class OperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ServiceSchema) private readonly services: Repository<ServiceSchema>,
    @InjectRepository(BookingSchema) private readonly bookingRows: Repository<BookingSchema>,
    @InjectRepository(PosInvoiceSchema) private readonly invoices: Repository<PosInvoiceSchema>,
    @InjectRepository(PosInvoiceItemSchema) private readonly invoiceItems: Repository<PosInvoiceItemSchema>,
    @InjectRepository(UserSchema) private readonly users: Repository<UserSchema>,
    @Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository,
    @Inject(SLOT_REPOSITORY) private readonly slots: ISlotRepository,
    private readonly quotePrice: QuotePriceUseCase,
    private readonly lockSlots: LockSlotsUseCase,
    private readonly confirmBooking: ConfirmBookingUseCase,
  ) {}

  async listServices(user: AuthenticatedUser, clusterId?: number) {
    this.assertOperational(user);
    if (clusterId !== undefined) await this.assertClusterAccess(user, clusterId);
    if (user.role === UserRole.OWNER && clusterId === undefined) {
      const clusters = await this.courts.findClusters({ ownerId: user.userId, bookableOnly: false });
      const clusterIds = clusters.map((cluster) => cluster.clusterId);
      return clusterIds.length ? this.services.find({ where: { clusterId: In(clusterIds), isActive: true }, order: { name: 'ASC' } }) : [];
    }
    return this.services.find({ where: { ...(clusterId ? { clusterId } : {}), isActive: true }, order: { name: 'ASC' } });
  }

  async listClusters(user: AuthenticatedUser) {
    this.assertOperational(user);
    const criteria = user.role === UserRole.OWNER
      ? { ownerId: user.userId, bookableOnly: false }
      : { bookableOnly: user.role !== UserRole.ADMIN };
    return (await this.courts.findClusters(criteria)).map(({ clusterId, name, address, city }) => ({ clusterId, name, address, city }));
  }

  async findCustomerByPhone(user: AuthenticatedUser, phone: string) {
    this.assertOperational(user);
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 9) throw new BadRequestException('Vui lòng nhập số điện thoại hợp lệ');
    const customer = await this.users.findOne({ where: { phoneNumber: normalizedPhone, role: UserRole.CUSTOMER, isActive: true } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng hoạt động với số điện thoại này');
    return { userId: customer.userId, fullName: customer.fullName, phoneNumber: customer.phoneNumber };
  }

  async listBookings(user: AuthenticatedUser) {
    this.assertOperational(user);
    let clusterIds: number[] | undefined;
    if (user.role === UserRole.OWNER) {
      clusterIds = (await this.courts.findClusters({ ownerId: user.userId, bookableOnly: false })).map((cluster) => cluster.clusterId);
      if (!clusterIds.length) return { items: [], total: 0, page: 1, pageSize: 50 };
    } else if (user.role === UserRole.STAFF) {
      clusterIds = (await this.courts.findClusters({ bookableOnly: true })).map((cluster) => cluster.clusterId);
      if (!clusterIds.length) return { items: [], total: 0, page: 1, pageSize: 50 };
    }
    const qb = this.bookingRows.createQueryBuilder('booking').orderBy('booking.start_time', 'ASC').take(50)
      .andWhere('booking.start_time >= CURRENT_DATE')
      .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.PAID, BookingStatus.CHECKED_IN] });
    if (clusterIds) qb.andWhere('booking.cluster_id IN (:...clusterIds)', { clusterIds });
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((row) => toBookingView(toDomainBooking(row))), total, page: 1, pageSize: 50 };
  }

  async createService(user: AuthenticatedUser, input: { clusterId: number; name: string; unit: string; price: number }) {
    this.assertOperational(user);
    await this.assertClusterAccess(user, input.clusterId);
    if (!input.name.trim() || !input.unit.trim() || input.price < 0) throw new BadRequestException('Thông tin dịch vụ không hợp lệ');
    return this.services.save(this.services.create({ ...input, name: input.name.trim(), unit: input.unit.trim(), price: String(input.price), isActive: true }));
  }

  async deactivateService(user: AuthenticatedUser, serviceId: number) {
    this.assertOperational(user);
    const service = await this.services.findOne({ where: { serviceId } });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');
    await this.assertClusterAccess(user, service.clusterId);
    service.isActive = false;
    await this.services.save(service);
    return { serviceId, isActive: false };
  }

  async updateService(user: AuthenticatedUser, serviceId: number, input: { name?: string; unit?: string; price?: number }) {
    this.assertOperational(user);
    const service = await this.services.findOne({ where: { serviceId } });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');
    await this.assertClusterAccess(user, service.clusterId);
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new BadRequestException('Tên dịch vụ không được để trống');
      service.name = input.name.trim();
    }
    if (input.unit !== undefined) {
      if (!input.unit.trim()) throw new BadRequestException('Đơn vị không được để trống');
      service.unit = input.unit.trim();
    }
    if (input.price !== undefined) {
      if (!Number.isFinite(input.price) || input.price < 0) throw new BadRequestException('Giá dịch vụ không hợp lệ');
      service.price = String(input.price);
    }
    return this.services.save(service);
  }

  async walkIn(user: AuthenticatedUser, input: { slotIds: number[]; customerUserId: number; expectedTotalAmount?: number }) {
    this.assertOperational(user);
    if (!input.slotIds?.length || !input.customerUserId) throw new BadRequestException('Cần chọn slot và khách hàng');
    const customer = await this.users.findOne({ where: { userId: input.customerUserId, role: UserRole.CUSTOMER, isActive: true } });
    if (!customer) throw new NotFoundException('Không tìm thấy tài khoản khách hàng đang hoạt động');
    const uniqueSlotIds = [...new Set(input.slotIds)];
    const selected = await this.slots.findByIds(null, uniqueSlotIds);
    if (selected.length !== uniqueSlotIds.length) throw new NotFoundException('Không tìm thấy một hoặc nhiều khung giờ đã chọn');
    selected.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    if (selected.some((slot) => slot.startTime.getTime() <= Date.now())) throw new BadRequestException('Không thể đặt khung giờ đã bắt đầu');
    if (selected.some((slot) => slot.courtId !== selected[0].courtId) || selected.some((slot, index) => index > 0 && selected[index - 1].endTime.getTime() !== slot.startTime.getTime())) {
      throw new BadRequestException('Chỉ chọn các khung giờ liền nhau trên cùng một sân');
    }
    const courtAmount = await this.quoteCourtPrice(selected[0].courtId, selected[0].startTime, selected[selected.length - 1].endTime);
    await this.lockSlots.execute({ slotIds: uniqueSlotIds, userId: input.customerUserId });
    return this.confirmBooking.execute({ slotIds: uniqueSlotIds, userId: input.customerUserId, note: `Walk-in tại quầy bởi nhân viên #${user.userId}`, expectedTotalAmount: courtAmount });
  }

  async checkIn(user: AuthenticatedUser, code: string) {
    this.assertOperational(user);
    const booking = await this.bookingRows.createQueryBuilder('booking')
      .where('booking.qr_code = :code OR booking.booking_code = :code', { code: code.trim() }).getOne();
    if (!booking) throw new NotFoundException('Không tìm thấy booking từ mã QR/mã đặt sân');
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(BookingSchema, { where: { bookingId: booking.bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Booking không tồn tại');
      await this.assertClusterAccess(user, locked.clusterId);
      const alreadyCheckedIn = locked.status === BookingStatus.CHECKED_IN;
      if (alreadyCheckedIn && locked.totalAmount !== null && Number(locked.totalAmount) > 0) throw new ConflictException('Booking này đã check-in');
      const domain = toDomainBooking(locked);
      if (!alreadyCheckedIn) domain.markCheckedIn(new Date());
      let priceWarning: string | undefined;
      if (domain.totalAmount === null || domain.totalAmount <= 0) {
        try {
          domain.totalAmount = await this.quoteCourtPrice(domain.courtId, domain.startTime, domain.endTime);
        } catch (error) {
          if (error instanceof DomainError && error.code === DomainErrorCode.INVALID_INPUT) {
            priceWarning = 'Chưa thể hiện tiền sân vì cụm sân chưa cấu hình bảng giá.';
          } else {
            throw error;
          }
        }
      }
      await manager.save(BookingSchema, toSchemaBooking(domain, locked));
      if (!alreadyCheckedIn) {
        await manager.save(CheckInSchema, manager.create(CheckInSchema, { bookingId: locked.bookingId, staffUserId: user.userId }));
      }
      return { bookingId: locked.bookingId, bookingCode: locked.bookingCode, status: BookingStatus.CHECKED_IN, totalAmount: domain.totalAmount, priceWarning, checkedInAt: new Date().toISOString() };
    });
  }

  async createInvoice(user: AuthenticatedUser, input: { bookingId: number; paymentMethod: 'CASH'|'CARD'|'TRANSFER'; items?: { serviceId: number; quantity: number }[] }) {
    this.assertOperational(user);
    const requestedItems = input.items ?? [];
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingSchema, { where: { bookingId: input.bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy booking');
      await this.assertClusterAccess(user, booking.clusterId);
      if (![BookingStatus.CONFIRMED, BookingStatus.PAID, BookingStatus.CHECKED_IN].includes(booking.status)) throw new ConflictException('Booking không thể lập hóa đơn');
      const ids = [...new Set(requestedItems.map((item) => item.serviceId))];
      if (requestedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) throw new BadRequestException('Số lượng dịch vụ phải từ 1');
      const catalog = await manager.find(ServiceSchema, { where: { serviceId: In(ids), clusterId: booking.clusterId, isActive: true } });
      if (catalog.length !== ids.length) throw new BadRequestException('Có dịch vụ không hoạt động hoặc không thuộc cụm sân của booking');
      const courtPrice = booking.totalAmount === null || Number(booking.totalAmount) <= 0
        ? await this.quoteCourtPrice(booking.courtId, booking.startTime, booking.endTime)
        : Number(booking.totalAmount);
      const collected = await manager.createQueryBuilder(PosInvoiceSchema, 'invoice')
        .select('COALESCE(SUM(invoice.court_amount), 0)', 'courtAmount')
        .where('invoice.booking_id = :bookingId', { bookingId: booking.bookingId })
        .getRawOne<{ courtAmount: string }>();
      const courtAlreadyPaid = booking.status === BookingStatus.PAID || Number(collected?.courtAmount ?? 0) > 0;
      const courtAmount = courtAlreadyPaid ? 0 : courtPrice;
      if (courtAmount <= 0 && requestedItems.length === 0) throw new ConflictException('Tiền sân đã được thanh toán; hãy chọn dịch vụ nếu cần lập thêm hóa đơn.');
      const invoice = await manager.save(PosInvoiceSchema, manager.create(PosInvoiceSchema, { invoiceCode: `POS-${randomUUID().slice(0, 12).toUpperCase()}`, bookingId: booking.bookingId, staffUserId: user.userId, clusterId: booking.clusterId, courtAmount: courtAmount.toFixed(2), total: '0', paymentMethod: input.paymentMethod }));
      let total = courtAmount;
      const lines: PosInvoiceItemSchema[] = [];
      for (const request of requestedItems) {
        const service = catalog.find((entry) => entry.serviceId === request.serviceId)!;
        const unitPrice = Number(service.price);
        const subtotal = unitPrice * request.quantity;
        total += subtotal;
        lines.push(manager.create(PosInvoiceItemSchema, { invoiceId: invoice.invoiceId, serviceId: service.serviceId, serviceName: service.name, quantity: request.quantity, unitPrice: service.price, subtotal: subtotal.toFixed(2) }));
      }
      await manager.save(PosInvoiceItemSchema, lines);
      invoice.total = total.toFixed(2);
      await manager.save(PosInvoiceSchema, invoice);
      if (booking.status === BookingStatus.CONFIRMED) booking.status = BookingStatus.PAID;
      booking.totalAmount = courtPrice.toFixed(2);
      await manager.save(BookingSchema, booking);
      return { ...invoice, items: lines };
    });
  }

  async getInvoice(invoiceId: number, user: AuthenticatedUser) {
    this.assertOperational(user);
    const invoice = await this.invoices.findOne({ where: { invoiceId } });
    if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
    return { ...invoice, items: await this.invoiceItems.find({ where: { invoiceId } }) };
  }

  private assertOperational(user: AuthenticatedUser) {
    if (!OPS_ROLES.includes(user.role)) throw new ForbiddenException('Tài khoản không có quyền vận hành tại quầy');
  }

  private async assertClusterAccess(user: AuthenticatedUser, clusterId: number) {
    if (user.role !== UserRole.OWNER) return;
    const cluster = await this.courts.findClusterById(clusterId);
    if (!cluster || cluster.ownerId !== user.userId) throw new ForbiddenException('Cụm sân không thuộc quyền quản lý của bạn');
  }

  private async quoteCourtPrice(courtId: number, startTime: Date, endTime: Date): Promise<number> {
    const quote = await this.quotePrice.execute({
      courtId,
      date: formatDate(startTime),
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
    });
    return quote.totalAmount;
  }
}

function formatDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
