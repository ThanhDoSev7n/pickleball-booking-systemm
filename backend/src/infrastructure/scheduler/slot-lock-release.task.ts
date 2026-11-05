import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ReleaseExpiredLocksUseCase } from '../../application/use-case/booking/release-expired-locks.use-case';

const INTERVAL_JOB_NAME = 'release-expired-locks';
const MIN_INTERVAL_SECONDS = 5;
const FALLBACK_INTERVAL_SECONDS = 30;

/**
 * muc 4.7.1: dung "eager release" bo tro cho lazy release khi user xem danh sach san.
 * Chu ky doc tu LOCK_RELEASE_INTERVAL_SECONDS nen khong the dung @Interval(CronExpression.*).
 */
@Injectable()
export class SlotLockReleaseTask implements OnModuleInit {
  private readonly logger = new Logger(SlotLockReleaseTask.name);

  constructor(
    private readonly releaseExpiredLocks: ReleaseExpiredLocksUseCase,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const seconds = Math.max(MIN_INTERVAL_SECONDS, Number(this.config.get('LOCK_RELEASE_INTERVAL_SECONDS', FALLBACK_INTERVAL_SECONDS)) || FALLBACK_INTERVAL_SECONDS);
    if (this.registry.doesExist('interval', INTERVAL_JOB_NAME)) {
      return;
    }
    this.registry.addInterval(INTERVAL_JOB_NAME, setInterval(() => void this.tick(), seconds * 1000));
    this.logger.log(`Task giai phong giu cho het han chay moi ${seconds}s`);
  }

  /** try/catch de loi DB tam thoi (maint, restart container) khong giet app. */
  private async tick(): Promise<void> {
    try {
      await this.releaseExpiredLocks.execute();
    } catch (error) {
      this.logger.error(`Loi khi giai phong giu cho: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
