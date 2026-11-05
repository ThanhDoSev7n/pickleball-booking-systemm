import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingModule } from './modules/booking.module';
import { CourtModule } from './modules/court.module';
import { IdentityModule } from './modules/identity.module';
import { SchedulerModule } from './modules/scheduler.module';
import { PricingModule } from './modules/pricing.module';

const DEFAULT_DB_PORT = 3306;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', String(DEFAULT_DB_PORT))),
        username: config.get<string>('DB_USERNAME', 'pickleball'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'pickleball_booking'),
        // Schema la source of truth (database/schema.sql + npm run db:setup): synchronize=true
        // se bi Xoa/doi cot khac ten uk_/idx_ trong SADD.
        synchronize: false,
        autoLoadEntities: true,
        charset: 'utf8mb4',
        timezone: 'local',
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
        // Load test dong thoi can nhieu connection hon mac dinh (10).
        extra: { connectionLimit: 20 },
      }),
    }),
    ScheduleModule.forRoot(),
    IdentityModule,
    CourtModule,
    PricingModule,
    BookingModule,
    SchedulerModule,
  ],
})
export class AppModule {}
