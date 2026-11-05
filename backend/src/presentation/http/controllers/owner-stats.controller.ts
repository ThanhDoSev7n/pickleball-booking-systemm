import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OwnerStats, OwnerStatsUseCase } from '../../../application/use-case/stats/owner-stats.use-case';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { StatsQueryDto } from '../dto/stats.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

/** Dashboard doanh thu: chi chu san (OWNER). */
@Controller('api/owner/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class OwnerStatsController {
  constructor(private readonly stats: OwnerStatsUseCase) {}

  @Get()
  get(@Query() query: StatsQueryDto, @CurrentUser() user: AuthenticatedUser): Promise<OwnerStats> {
    return this.stats.execute(user.userId, query.range ?? '7days');
  }
}