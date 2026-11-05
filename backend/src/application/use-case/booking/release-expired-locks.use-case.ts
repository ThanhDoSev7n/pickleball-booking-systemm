import { Inject, Injectable, Logger } from '@nestjs/common';
import { SLOT_LOCK_MANAGER, SlotLockManager } from '../../../domain/service/slot-lock.manager';

/**
 * Cron body muc 4.7.1: giai phong toan bo giu cho da het han.
 * Day la "eager release", bo tro cho lazy release trong SearchAvailabilityUseCase.
 */
@Injectable()
export class ReleaseExpiredLocksUseCase {
  private readonly logger = new Logger(ReleaseExpiredLocksUseCase.name);

  constructor(@Inject(SLOT_LOCK_MANAGER) private readonly slotLock: SlotLockManager) {}

  async execute(): Promise<number> {
    const released = await this.slotLock.releaseExpiredLocks();
    if (released > 0) {
      this.logger.log(`Da giai phong ${released} giu cho het han`);
    }
    return released;
  }
}
