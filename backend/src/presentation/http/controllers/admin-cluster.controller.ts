import { Body, Controller, Get, Inject, NotFoundException, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { COURT_REPOSITORY, ICourtRepository } from '../../../domain/port/court.repository.port';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

class ClusterDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}

@Controller('api/admin/clusters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminClusterController {
  constructor(@Inject(COURT_REPOSITORY) private readonly courts: ICourtRepository) {}

  @Get()
  list() {
    return this.courts.findClusters({ bookableOnly: false });
  }

  @Patch(':id/decision')
  async decide(@Param('id', ParseIntPipe) id: number, @Body() dto: ClusterDecisionDto) {
    const cluster = await this.courts.setClusterStatus(id, dto.status);
    if (!cluster) throw new NotFoundException('Không tìm thấy cụm sân');
    return cluster;
  }
}