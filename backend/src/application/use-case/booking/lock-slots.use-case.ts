import { Inject, Injectable } from '@nestjs/common';
import {
  AcquireLockResult,
  SLOT_LOCK_MANAGER,
  SlotLockManager,
} from '../../../domain/service/slot-lock.manager';

export interface LockSlotsInput {
  slotIds: number[];
  userId: number;
}

export interface LockSlotsResult {
  lockedSlots: AcquireLockResult['lockedSlots'];
  ttlMinutes: number;
  lockExpiresAt: Date;
  /** Giay con lai den khi het han giu cho - frontend dung cho countdown. */
  remainingSeconds: number;
}

/** FR-02: giu cho slot (LOCKED, mac dinh 5 phut). */
@Injectable()
export class LockSlotsUseCase {
  constructor(@Inject(SLOT_LOCK_MANAGER) private readonly slotLock: SlotLockManager) {}

  async execute(input: LockSlotsInput): Promise<LockSlotsResult> {
    const now = new Date();
    const result = await this.slotLock.acquireLocks(input.slotIds, input.userId, now);
    return {
      lockedSlots: result.lockedSlots,
      ttlMinutes: result.ttlMinutes,
      lockExpiresAt: result.lockExpiresAt,
      remainingSeconds: Math.max(
        0,
        Math.floor((result.lockExpiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }
}
