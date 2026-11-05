import { DomainError, DomainErrorCode } from '../error/domain.error';
import { BookingSlot } from '../model/booking-slot.entity';
import { ISlotRepository } from '../port/slot.repository.port';
import { ITransactionManager, TransactionHandle } from '../port/transaction.port';
import { SlotStatus } from '../value-object/slot-status.vo';

/** Token DI: SlotLockManager la domain service thuan TS, duoc provide bang useFactory o module. */
export const SLOT_LOCK_MANAGER = 'SLOT_LOCK_MANAGER';

/** MySQL error 1213 - ER_LOCK_DEADLOCK (muc 4.6.2). */
export const MYSQL_DEADLOCK_ERRNO = 1213;
/** MySQL error 1205 - ER_LOCK_WAIT_TIMEOUT. */
const MYSQL_LOCK_WAIT_TIMEOUT_ERRNO = 1205;

export interface SlotLockOutcome {
  slotId: number;
  courtId: number;
  status: SlotStatus.LOCKED;
  lockExpiresAt: Date;
  /** True neu slot da duoc giu boi chinh user nay va duoc gia han/idempotent. */
  alreadyLockedByRequester: boolean;
}

export interface AcquireLockResult {
  lockedSlots: SlotLockOutcome[];
  ttlMinutes: number;
  lockExpiresAt: Date;
}

export interface LockConfig {
  ttlMinutes: number;
  deadlockMaxRetries: number;
  deadlockBackoffBaseMs: number;
}

/**
 * SlotLockManager - muc 4.5.2 / 4.7.1.
 * Dong goi toan bo thuat toan khoa bi quan:
 *   BEGIN -> SELECT ... FOR UPDATE -> kiem tra -> UPDATE status='LOCKED' -> COMMIT
 * Thoi gian giu khoa trong DB chi bang chieu dai transaction (< 50 ms muc 4.1.3);
 * "giu cho 5 phut" duoc bieu dien bang cot lock_expires_at, KHONG phai bang viec giu DB lock.
 */
export class SlotLockManager {
  constructor(
    private readonly slotRepository: ISlotRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly config: LockConfig,
  ) {}

  /**
   * Khoa mot hoac nhieu slot (FR-02).
   * Bat buoc thu tu khoa theo slotId tang dan de tranh circular deadlock (muc 4.6.2).
   */
  async acquireLocks(
    rawSlotIds: number[],
    userId: number,
    now: Date = new Date(),
  ): Promise<AcquireLockResult> {
    if (rawSlotIds.length === 0) {
      throw new DomainError(DomainErrorCode.SLOT_NOT_FOUND, 'Chua chon khung gio nao');
    }
    const slotIds = [...new Set(rawSlotIds)].sort((a, b) => a - b);
    if (slotIds.length > 8) {
      throw new DomainError(
        DomainErrorCode.SLOT_NOT_AVAILABLE,
        'Mot don dat chi duoc phep toi da 8 slot lien tiep',
        { requested: slotIds.length },
      );
    }

    return this.withDeadlockRetry(`acquire:${userId}:${slotIds.join(',')}`, () =>
      this.transactionManager.runInTransaction((tx) => this.acquireWithinTransaction(tx, slotIds, userId, now)),
    );
  }

  private async acquireWithinTransaction(
    tx: TransactionHandle,
    slotIds: number[],
    userId: number,
    now: Date,
  ): Promise<AcquireLockResult> {
    const locked: SlotLockOutcome[] = [];

    for (const slotId of slotIds) {
      // STEP 2: SELECT ... FOR UPDATE - InnoDB dat record lock (next-key lock o REPEATABLE READ).
      const slot = await this.slotRepository.findForUpdate(tx, slotId);
      if (slot === null) {
        throw new DomainError(DomainErrorCode.SLOT_NOT_FOUND, `Slot ${slotId} khong ton tai`, {
          slotId,
        });
      }
      if (slot.isPast(now)) {
        throw new DomainError(
          DomainErrorCode.SLOT_NOT_AVAILABLE,
          'Khung gio da qua, khong the dat',
          { slotId, startTime: slot.startTime.toISOString() },
        );
      }

      const wasExpiredLock = slot.isLockExpiredAt(now);
      const alreadyMine = slot.isLockedBy(userId) && !wasExpiredLock;

      // STEP 3 (domain): kiem tra trang thai + lazy release.
      slot.lock(userId, this.config.ttlMinutes, now);

      if (slot.status !== SlotStatus.LOCKED) {
        // STEP 4 ROLLBACK duoc handle bang cach nem loi de transaction manager rollback.
        throw new DomainError(
          DomainErrorCode.SLOT_NOT_AVAILABLE,
          `Slot ${slotId} khong con trong`,
          { slotId },
        );
      }

      // STEP 4: UPDATE booking_slots SET status='LOCKED', locked_by, lock_expires_at.
      await this.slotRepository.save(tx, slot);

      locked.push({
        slotId: slot.slotId,
        courtId: slot.courtId,
        status: SlotStatus.LOCKED,
        lockExpiresAt: slot.lockExpiresAt as Date,
        alreadyLockedByRequester: alreadyMine && !wasExpiredLock,
      });
    }

    // STEP 5: COMMIT (transaction manager tu dong khi callback resolve).
    return {
      lockedSlots: locked,
      ttlMinutes: this.config.ttlMinutes,
      lockExpiresAt: locked.reduce(
        (earliest, item) => (item.lockExpiresAt.getTime() < earliest.getTime() ? item.lockExpiresAt : earliest),
        locked[0].lockExpiresAt,
      ),
    };
  }

  /** Huy giu cho som (user bam "Huy" hoac dong tab). */
  async releaseLock(slotId: number, userId: number, now: Date = new Date()): Promise<BookingSlot> {
    return this.withDeadlockRetry(`release:${userId}:${slotId}`, () =>
      this.transactionManager.runInTransaction(async (tx) => {
        const slot = await this.slotRepository.findForUpdate(tx, slotId);
        if (slot === null) {
          throw new DomainError(DomainErrorCode.SLOT_NOT_FOUND, `Slot ${slotId} khong ton tai`);
        }
        // Ownership check lop 2 (muc 4.7.3): Customer chi thao tac tren giu cho cua minh.
        if (slot.status === SlotStatus.LOCKED && slot.lockedBy !== null && slot.lockedBy !== userId) {
          throw new DomainError(
            DomainErrorCode.SLOT_NOT_LOCKED_BY_USER,
            'Slot dang duoc giu boi tai khoan khac',
            { slotId },
          );
        }
        if (slot.status === SlotStatus.BOOKED) {
          throw new DomainError(
            DomainErrorCode.SLOT_ALREADY_BOOKED,
            'Slot da duoc dat, hay dung chuc nang huy lich',
            { slotId },
          );
        }
        slot.releaseLock();
        return this.slotRepository.save(tx, slot);
      }),
    );
  }

  /**
   * Xac minh giu cho van con hieu luc truoc khi tao booking (buoc 2 muc 4.7.2).
   * Duoc ConfirmBookingUseCase goi ben trong cung transaction voi tao booking.
   */
  async assertLockHeld(
    tx: TransactionHandle,
    slotIds: number[],
    userId: number,
    now: Date,
  ): Promise<BookingSlot[]> {
    const slots: BookingSlot[] = [];
    for (const slotId of [...new Set(slotIds)].sort((a, b) => a - b)) {
      const slot = await this.slotRepository.findForUpdate(tx, slotId);
      if (slot === null) {
        throw new DomainError(DomainErrorCode.SLOT_NOT_FOUND, `Slot ${slotId} khong ton tai`);
      }
      if (slot.isLockExpiredAt(now)) {
        throw new DomainError(
          DomainErrorCode.SLOT_LOCK_EXPIRED,
          'Thoi gian giu cho da het han, hay chon lai khung gio',
          { slotId },
        );
      }
      if (slot.status !== SlotStatus.LOCKED || slot.lockedBy !== userId) {
        throw new DomainError(
          DomainErrorCode.SLOT_NOT_LOCKED_BY_USER,
          'Ban khong phai la nguoi giu cho slot nay',
          { slotId, status: slot.status },
        );
      }
      slots.push(slot);
    }
    return slots;
  }

  /**
   * Cron + lazy release: UPDATE ... WHERE status='LOCKED' AND lock_expires_at < NOW().
   * Tra ve so slot bi giai phong.
   */
  async releaseExpiredLocks(now: Date = new Date()): Promise<number> {
    return this.slotRepository.releaseExpiredLocks(now);
  }

  /**
   * Retry co gioi han khi gap deadlock/lock wait timeout.
   * Thu tu khoa da duoc sap xep nen case nay hy hien rat it (muc 4.6.2).
   */
  private async withDeadlockRetry<T>(label: string, work: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.deadlockMaxRetries; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if (!isRetryableDbError(error)) {
          throw error;
        }
        lastError = error;
        if (attempt === this.config.deadlockMaxRetries) {
          break;
        }
        await sleep(this.config.deadlockBackoffBaseMs * 2 ** attempt);
      }
    }
    throw new DomainError(
      DomainErrorCode.DEADLOCK_RETRY_EXHAUSTED,
      `Xung dot khoa lien tiep khi thuc hien ${label}, vui long thu lai`,
      { cause: describeError(lastError), retries: this.config.deadlockMaxRetries },
    );
  }
}

export function isRetryableDbError(error: unknown): boolean {
  const errno = readErrno(error);
  return errno === MYSQL_DEADLOCK_ERRNO || errno === MYSQL_LOCK_WAIT_TIMEOUT_ERRNO;
}

function readErrno(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = error as { errno?: number; code?: string; driverError?: { errno?: number; code?: string } };
  if (typeof candidate.errno === 'number') {
    return candidate.errno;
  }
  if (typeof candidate.driverError?.errno === 'number') {
    return candidate.driverError.errno;
  }
  const mysqlCode = candidate.code ?? candidate.driverError?.code;
  if (mysqlCode === 'ER_LOCK_DEADLOCK') {
    return MYSQL_DEADLOCK_ERRNO;
  }
  if (mysqlCode === 'ER_LOCK_WAIT_TIMEOUT') {
    return MYSQL_LOCK_WAIT_TIMEOUT_ERRNO;
  }
  return undefined;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
