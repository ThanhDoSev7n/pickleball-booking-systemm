import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { CourtType } from '../../../domain/value-object/court-type.vo';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreatePricingRuleDto {
  @IsOptional()
  @IsEnum(CourtType, { message: 'courtType phai la OUTDOOR, INDOOR hoac COMPETITION' })
  courtType?: CourtType;

  @IsIn(['WEEKDAY', 'WEEKEND', 'HOLIDAY'], { message: 'dayType phai la WEEKDAY, WEEKEND hoac HOLIDAY' })
  dayType!: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

  @Matches(CLOCK_PATTERN, { message: 'startTime phai theo dang HH:mm' })
  startTime!: string;

  @Matches(CLOCK_PATTERN, { message: 'endTime phai theo dang HH:mm' })
  endTime!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'pricePerHour phai lon hon 0' })
  pricePerHour!: number;
}

export class QuoteQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courtId!: number;

  @Matches(DATE_PATTERN, { message: 'date phai theo dang yyyy-MM-dd' })
  date!: string;

  @Matches(CLOCK_PATTERN, { message: 'startTime phai theo dang HH:mm' })
  startTime!: string;

  @Matches(CLOCK_PATTERN, { message: 'endTime phai theo dang HH:mm' })
  endTime!: string;
}