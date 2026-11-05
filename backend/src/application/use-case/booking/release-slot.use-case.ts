import { Inject, Injectable } from '@nestjs/common';
import { SLOT_LOCK_MANAGER, SlotLockManager } from '../../../domain/service/slot-lock.manager';

export interface ReleaseSlotInput {
  slotId: number;
  userId: number;
}

export interface ReleaseSlotResult {
  slotId: number;
  status: string;
}

/** User huy giu cho som (dong tab, bam "Huy") - slot ve AVAILABLE cho nguoi khac. */
@Injectable()
export class ReleaseSlotUseCase {
  constructor(@Inject(SLOT_LOCK_MANAGER) private readonly slotLock: SlotLockManager) {}

  async execute(input: ReleaseSlotInput): Promise<ReleaseSlotResult> {
    const slot = await this.slotLock.releaseLock(input.slotId, input.userId);
    return { slotId: slot.slotId, status: slot.status };
  }
}
