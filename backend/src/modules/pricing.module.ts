import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ManagePricingUseCase,
  QuotePriceUseCase,
} from '../application/use-case/pricing/pricing.use-case';
import { PRICING_REPOSITORY } from '../domain/port/pricing.repository.port';
import { PricingRuleSchema } from '../infrastructure/persistence/typeorm/entities/pricing-rule.schema';
import { TypeOrmPricingRepository } from '../infrastructure/persistence/typeorm/repositories/pricing.repository';
import { PricingController } from '../presentation/http/controllers/pricing.controller';
import { CourtModule } from './court.module';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRuleSchema]), CourtModule],
  controllers: [PricingController],
  providers: [
    { provide: PRICING_REPOSITORY, useClass: TypeOrmPricingRepository },
    ManagePricingUseCase,
    QuotePriceUseCase,
  ],
  exports: [QuotePriceUseCase],
})
export class PricingModule {}