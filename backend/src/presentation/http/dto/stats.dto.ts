import { IsIn, IsOptional } from 'class-validator';

export class StatsQueryDto {
  @IsOptional()
  @IsIn(['today', '7days', 'month'], { message: 'range phai la today, 7days hoac month' })
  range?: 'today' | '7days' | 'month';
}