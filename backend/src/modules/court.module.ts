import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { COURT_REPOSITORY } from '../domain/port/court.repository.port';
import { CourtClusterSchema } from '../infrastructure/persistence/typeorm/entities/court-cluster.schema';
import { CourtSchema } from '../infrastructure/persistence/typeorm/entities/court.schema';
import { TypeOrmCourtRepository } from '../infrastructure/persistence/typeorm/repositories/court.repository';

/** Reference data san/cum san - Booking Context chi doc (Thanh vien 2 ghi). */
@Module({
  imports: [TypeOrmModule.forFeature([CourtSchema, CourtClusterSchema])],
  providers: [{ provide: COURT_REPOSITORY, useClass: TypeOrmCourtRepository }],
  exports: [COURT_REPOSITORY],
})
export class CourtModule {}
