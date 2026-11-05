import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './presentation/http/filters/domain-exception.filter';

const DEFAULT_PORT = 3000;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3001';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', DEFAULT_FRONTEND_ORIGIN),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  // Khong setGlobalPrefix: controller da viet duong dan api/... day du.
  const port = Number(config.get<string>('PORT', String(DEFAULT_PORT)));
  await app.listen(port);
  logger.log(`Backend dang chay tai http://localhost:${port}/api/availability`);
}

void bootstrap();
