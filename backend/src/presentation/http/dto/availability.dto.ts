import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, MaxLength, Min } from 'class-validator';
import { CourtType } from '../../../domain/value-object/court-type.vo';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** GET /api/availability - FR-01. */
export class AvailabilityQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date phai theo dang yyyy-MM-dd' })
  date?: string;

  @IsOptional()
  @MaxLength(80, { message: 'city toi da 80 ky tu' })
  city?: string;

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
  @IsEnum(CourtType, { message: 'courtType phai la OUTDOOR, INDOOR hoac COMPETITION' })
  courtType?: CourtType;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'timeFrom phai theo dang HH:mm' })
  timeFrom?: string;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'timeTo phai theo dang HH:mm' })
  timeTo?: string;
}
