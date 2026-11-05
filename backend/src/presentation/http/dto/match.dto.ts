import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

export class CreateMatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clusterId!: number;

  @Matches(DATE_PATTERN, { message: 'playDate phai theo dang yyyy-MM-dd' })
  playDate!: string;

  @Matches(CLOCK_PATTERN, { message: 'startTime phai theo dang HH:mm' })
  startTime!: string;

  @Matches(CLOCK_PATTERN, { message: 'endTime phai theo dang HH:mm' })
  endTime!: string;

  @IsIn(SKILL_LEVELS, { message: 'skillLevel phai la BEGINNER, INTERMEDIATE hoac ADVANCED' })
  skillLevel!: (typeof SKILL_LEVELS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'playersNeeded toi thieu 1' })
  @Max(10, { message: 'playersNeeded toi da 10' })
  playersNeeded!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class MatchQueryDto {
  @IsOptional()
  @IsIn(SKILL_LEVELS, { message: 'skillLevel phai la BEGINNER, INTERMEDIATE hoac ADVANCED' })
  skillLevel?: (typeof SKILL_LEVELS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clusterId?: number;
}