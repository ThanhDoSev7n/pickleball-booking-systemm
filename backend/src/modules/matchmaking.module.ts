import { Module } from '@nestjs/common';
import { MatchmakingUseCase } from '../application/use-case/matchmaking/matchmaking.use-case';
import { MATCH_REPOSITORY } from '../domain/port/match.repository.port';
import { TypeOrmMatchRepository } from '../infrastructure/persistence/typeorm/repositories/match.repository';
import { MatchController } from '../presentation/http/controllers/match.controller';
import { CourtModule } from './court.module';

@Module({
  imports: [CourtModule],
  controllers: [MatchController],
  providers: [{ provide: MATCH_REPOSITORY, useClass: TypeOrmMatchRepository }, MatchmakingUseCase],
})
export class MatchmakingModule {}