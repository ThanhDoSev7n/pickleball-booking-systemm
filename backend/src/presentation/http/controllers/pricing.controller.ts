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
import {
  ManagePricingUseCase,
  PriceQuote,
  QuotePriceUseCase,
} from '../../../application/use-case/pricing/pricing.use-case';
import { PricingRule } from '../../../domain/port/pricing.repository.port';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CreatePricingRuleDto, QuoteQueryDto } from '../dto/pricing.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@Controller('api')
export class PricingController {
  constructor(
    private readonly managePricing: ManagePricingUseCase,
    private readonly quotePrice: QuotePriceUseCase,
  ) {}

  /** Cong khai: bao gia truoc khi dat. */
  @Get('pricing/quote')
  quote(@Query() query: QuoteQueryDto): Promise<PriceQuote> {
    return this.quotePrice.execute(query);
  }

  @Get('owner/clusters/:clusterId/pricing-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  list(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PricingRule[]> {
    return this.managePricing.listRules(user, clusterId);
  }

  @Post('owner/clusters/:clusterId/pricing-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Body() dto: CreatePricingRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PricingRule> {
    return this.managePricing.createRule(user, { ...dto, clusterId });
  }

  @HttpCode(HttpStatus.OK)
  @Delete('owner/pricing-rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.managePricing.deleteRule(user, id);
    return { success: true };
  }
}