import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingModule } from './booking.module';
import { CourtModule } from './court.module';
import { PricingModule } from './pricing.module';
import { OperationsController } from '../presentation/http/controllers/operations.controller';
import { OperationsService } from '../application/use-case/operations/operations.service';
import { ServiceSchema } from '../infrastructure/persistence/typeorm/entities/service.schema';
import { BookingSchema } from '../infrastructure/persistence/typeorm/entities/booking.schema';
import { PosInvoiceSchema, PosInvoiceItemSchema } from '../infrastructure/persistence/typeorm/entities/pos-invoice.schema';
import { CheckInSchema } from '../infrastructure/persistence/typeorm/entities/check-in.schema';
import { UserSchema } from '../infrastructure/persistence/typeorm/entities/user.schema';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceSchema, BookingSchema, PosInvoiceSchema, PosInvoiceItemSchema, CheckInSchema, UserSchema]), BookingModule, CourtModule, PricingModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
