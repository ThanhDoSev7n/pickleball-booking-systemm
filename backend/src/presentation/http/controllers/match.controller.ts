import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchmakingUseCase } from '../../../application/use-case/matchmaking/matchmaking.use-case';
import { MatchPost } from '../../../domain/port/match.repository.port';
import { ALL_ROLES } from '../../../domain/value-object/user-role.vo';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CreateMatchDto, MatchQueryDto } from '../dto/match.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@Controller('api/matches')
export class MatchController {
  constructor(private readonly matchmaking: MatchmakingUseCase) {}

  /** Cong khai: xem danh sach bai dang, loc theo trinh do. */
  @Get()
  list(@Query() query: MatchQueryDto): Promise<MatchPost[]> {
    return this.matchmaking.list(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  create(@Body() dto: CreateMatchDto, @CurrentUser() user: AuthenticatedUser): Promise<MatchPost> {
    return this.matchmaking.create({ ...dto, creatorId: user.userId });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  join(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<MatchPost> {
    return this.matchmaking.join(id, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  leave(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<MatchPost> {
    return this.matchmaking.leave(id, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.matchmaking.cancel(id, user.userId);
    return { success: true };
  }
}