import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManageCourtsUseCase } from '../application/use-case/court/manage-courts.use-case';
import { COURT_REPOSITORY } from '../domain/port/court.repository.port';
import { CourtClusterSchema } from '../infrastructure/persistence/typeorm/entities/court-cluster.schema';
import { CourtSchema } from '../infrastructure/persistence/typeorm/entities/court.schema';
import { TypeOrmCourtRepository } from '../infrastructure/persistence/typeorm/repositories/court.repository';
import { OwnerCourtController } from '../presentation/http/controllers/owner-court.controller';
import { AdminClusterController } from '../presentation/http/controllers/admin-cluster.controller';

/** Reference data san/cum san + API quan ly cho chu san (Thanh vien 2). */
@Module({
  imports: [TypeOrmModule.forFeature([CourtSchema, CourtClusterSchema])],
  controllers: [OwnerCourtController, AdminClusterController],
  providers: [
    { provide: COURT_REPOSITORY, useClass: TypeOrmCourtRepository },
    ManageCourtsUseCase,
  ],
  exports: [COURT_REPOSITORY],
})
export class CourtModule {}