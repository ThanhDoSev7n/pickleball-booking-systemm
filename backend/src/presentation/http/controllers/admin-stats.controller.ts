import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OwnerStatsUseCase } from '../../../application/use-case/stats/owner-stats.use-case';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { Roles } from '../decorators/roles.decorator';
import { StatsQueryDto } from '../dto/stats.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@Controller('api/admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminStatsController {
  constructor(private readonly stats: OwnerStatsUseCase) {}

  @Get()
  get(@Query() query: StatsQueryDto) {
    return this.stats.execute(null, query.range ?? '7days');
  }
}
