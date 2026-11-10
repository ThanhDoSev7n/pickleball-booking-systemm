import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus } from '../../../domain/value-object/booking-status.vo';

/** Khop voi SlotLockManager.acquireLocks - toi da 8 slot/don dat (FR-02). */
const MAX_SLOTS_PER_BOOKING = 8;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class LockSlotsDto {
  @IsArray({ message: 'slotIds phai la mang' })
  @ArrayMinSize(1, { message: 'Chua chon khung gio nao' })
  @ArrayMaxSize(MAX_SLOTS_PER_BOOKING, { message: 'Mot don dat chi toi da 8 khung gio' })
  @IsInt({ each: true, message: 'slotIds phai la so nguyen' })
  slotIds!: number[];
}

export class ConfirmBookingDto {
  @IsArray({ message: 'slotIds phai la mang' })
  @ArrayMinSize(1, { message: 'Chua chon khung gio nao' })
  @ArrayMaxSize(MAX_SLOTS_PER_BOOKING, { message: 'Mot don dat chi toi da 8 khung gio' })
  @IsInt({ each: true, message: 'slotIds phai la so nguyen' })
  slotIds!: number[];

  @IsOptional()
  @IsString({ message: 'note phai la chuoi' })
  @MaxLength(255, { message: 'note toi da 255 ky tu' })
  note?: string | null;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString({ message: 'reason phai la chuoi' })
  @MaxLength(255, { message: 'reason toi da 255 ky tu' })
  reason?: string;
}

/** GET /api/bookings - role cua requester quyet pham vi loc, xem GetMyBookingsUseCase. */
export class BookingListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'clusterId phai so nguyen' })
  @Min(1, { message: 'clusterId khong hop le' })
  clusterId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'courtId phai so nguyen' })
  @Min(1, { message: 'courtId khong hop le' })
  courtId?: number;

  @IsOptional()
  @IsEnum(BookingStatus, { message: 'status khong hop le' })
  status?: BookingStatus;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from phai theo dang yyyy-MM-dd' })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to phai theo dang yyyy-MM-dd' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phai so nguyen' })
  @Min(1, { message: 'page bat dau tu 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize phai so nguyen' })
  @Min(1, { message: 'pageSize toi thieu la 1' })
  pageSize?: number;
}
