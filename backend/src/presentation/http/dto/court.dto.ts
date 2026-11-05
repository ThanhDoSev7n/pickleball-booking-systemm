import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CourtType } from '../../../domain/value-object/court-type.vo';

const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateClusterDto {
  @IsString()
  @IsNotEmpty({ message: 'name khong duoc de trong' })
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'address khong duoc de trong' })
  @MaxLength(255)
  address!: string;

  @IsString()
  @IsNotEmpty({ message: 'city khong duoc de trong' })
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCourtDto {
  @IsString()
  @IsNotEmpty({ message: 'name khong duoc de trong' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(CourtType, { message: 'courtType phai la OUTDOOR, INDOOR hoac COMPETITION' })
  courtType?: CourtType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  surface?: string;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'openingTime phai theo dang HH:mm' })
  openingTime?: string;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'closingTime phai theo dang HH:mm' })
  closingTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90], { message: 'slotDurationMinutes phai la 30, 60 hoac 90' })
  slotDurationMinutes?: number;
}

export class UpdateCourtDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(CourtType, { message: 'courtType phai la OUTDOOR, INDOOR hoac COMPETITION' })
  courtType?: CourtType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  surface?: string;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'openingTime phai theo dang HH:mm' })
  openingTime?: string;

  @IsOptional()
  @Matches(CLOCK_PATTERN, { message: 'closingTime phai theo dang HH:mm' })
  closingTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90], { message: 'slotDurationMinutes phai la 30, 60 hoac 90' })
  slotDurationMinutes?: number;
}