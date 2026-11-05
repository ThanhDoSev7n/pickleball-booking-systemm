import { Module } from '@nestjs/common';
import { OwnerStatsUseCase } from '../application/use-case/stats/owner-stats.use-case';
import { STATS_REPOSITORY } from '../domain/port/stats.repository.port';
import { TypeOrmStatsRepository } from '../infrastructure/persistence/typeorm/repositories/stats.repository';
import { OwnerStatsController } from '../presentation/http/controllers/owner-stats.controller';
import { PricingModule } from './pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [OwnerStatsController],
  providers: [{ provide: STATS_REPOSITORY, useClass: TypeOrmStatsRepository }, OwnerStatsUseCase],
})
export class StatsModule {}