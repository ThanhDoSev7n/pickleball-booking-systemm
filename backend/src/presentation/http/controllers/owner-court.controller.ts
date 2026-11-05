import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Court, CourtCluster } from '../../../domain/model/court.entity';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { ManageCourtsUseCase } from '../../../application/use-case/court/manage-courts.use-case';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import {
  CreateClusterDto,
  CreateCourtDto,
  UpdateClusterDto,
  UpdateCourtDto,
} from '../dto/court.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

/** Chu san quan ly cum san va san con. */
@Controller('api/owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class OwnerCourtController {
  constructor(private readonly manageCourts: ManageCourtsUseCase) {}

  @Get('clusters')
  listClusters(@CurrentUser() user: AuthenticatedUser): Promise<CourtCluster[]> {
    return this.manageCourts.listMyClusters(user);
  }

  @Post('clusters')
  createCluster(
    @Body() dto: CreateClusterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourtCluster> {
    return this.manageCourts.createCluster(user, dto);
  }

  @Patch('clusters/:id')
  updateCluster(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClusterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourtCluster> {
    return this.manageCourts.updateCluster(user, id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('clusters/:id')
  async hideCluster(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.manageCourts.setClusterActive(user, id, false);
    return { success: true };
  }

  @Post('clusters/:clusterId/courts')
  createCourt(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Body() dto: CreateCourtDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Court> {
    return this.manageCourts.createCourt(user, clusterId, dto);
  }

  @Patch('courts/:id')
  updateCourt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourtDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Court> {
    return this.manageCourts.updateCourt(user, id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('courts/:id')
  async hideCourt(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.manageCourts.setCourtActive(user, id, false);
    return { success: true };
  }
}