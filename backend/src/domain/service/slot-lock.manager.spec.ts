import { DomainErrorCode } from '../error/domain.error';
import { BookingSlot } from '../model/booking-slot.entity';
import { ISlotRepository } from '../port/slot.repository.port';
import { ITransactionManager } from '../port/transaction.port';
import { SlotStatus } from '../value-object/slot-status.vo';
import { SlotLockManager } from './slot-lock.manager';

const TTL_MINUTES = 5;

interface FakeStore {
  slots: Map<number, BookingSlot>;
  saveCount: number;
  lockOrder: number[];
}

/**
 * Test double cap port - chung minh SlotLockManager unit-test duoc ma khong can MySQL,
 * dung theo yeu cau testability muc 2.4.1.
 */
function buildManager(store: FakeStore, options?: { transactionFails?: number }) {
  const repository = {
    async findForUpdate(_tx: unknown, slotId: number) {
      store.lockOrder.push(slotId);
      const slot = store.slots.get(slotId);
      return slot ? cloneSlot(slot) : null;
    },
    async save(_tx: unknown, slot: BookingSlot) {
      store.saveCount += 1;
      store.slots.set(slot.slotId, cloneSlot(slot));
      return slot;
    },
    async releaseExpiredLocks(now: Date) {
      let released = 0;
      for (const slot of store.slots.values()) {
        if (slot.status === SlotStatus.LOCKED && slot.isLockExpiredAt(now)) {
          slot.releaseLock();
          released += 1;
        }
      }
      return released;
    },
  } as unknown as ISlotRepository;

  let transactionAttempts = 0;
  const transactionManager = {
    async runInTransaction<T>(work: (tx: { id: string }) => Promise<T>): Promise<T> {
      transactionAttempts += 1;
      if (options?.transactionFails && transactionAttempts <= options.transactionFails) {
        const error = Object.assign(new Error('ER_LOCK_DEADLOCK'), { errno: 1213 });
        throw error;
      }
      return work({ id: `tx-${transactionAttempts}` });
    },
  } as unknown as ITransactionManager;

  return {
    manager: new SlotLockManager(repository, transactionManager, {
      ttlMinutes: TTL_MINUTES,
      deadlockMaxRetries: 3,
      deadlockBackoffBaseMs: 1,
    }),
    get attempts() {
      return transactionAttempts;
    },
  };
}

function cloneSlot(slot: BookingSlot): BookingSlot {
  const copy = BookingSlot.create({
    courtId: slot.courtId,
    startTime: slot.startTime,
    endTime: slot.endTime,
  });
  Object.assign(copy, {
    slotId: slot.slotId,
    status: slot.status,
    lockedBy: slot.lockedBy,
    lockExpiresAt: slot.lockExpiresAt,
    bookingId: slot.bookingId,
  });
  return copy;
}

function availableSlot(slotId: number, options?: { startOffsetHours?: number }): BookingSlot {
  const start = new Date(Date.now() + (options?.startOffsetHours ?? 6) * 3_600_000);
  const slot = BookingSlot.create({ courtId: 1, startTime: start, endTime: new Date(start.getTime() + 3_600_000) });
  slot.slotId = slotId;
  return slot;
}

describe('SlotLockManager - thuat toan khoa bi quan muc 4.7.1', () => {
  it('Khoa slot AVAILABLE va dat dung TTL 5 phut (TC-BOOK-01)', async () => {
    const store: FakeStore = { slots: new Map([[1, availableSlot(1)]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);
    const now = new Date();

    const result = await manager.acquireLocks([1], 100, now);

    expect(result.lockedSlots).toHaveLength(1);
    expect(result.ttlMinutes).toBe(TTL_MINUTES);
    const stored = store.slots.get(1) as BookingSlot;
    expect(stored.status).toBe(SlotStatus.LOCKED);
    expect(stored.lockedBy).toBe(100);
    expect((stored.lockExpiresAt as Date).getTime()).toBe(now.getTime() + TTL_MINUTES * 60_000);
  });

  it('Slot da LOCKED boi user khac bi tu choi bang SLOT_NOT_AVAILABLE (TC-BOOK-02, NFR-02)', async () => {
    const held = availableSlot(1);
    held.lock(200, TTL_MINUTES, new Date());
    const store: FakeStore = { slots: new Map([[1, held]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(manager.acquireLocks([1], 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.SLOT_NOT_AVAILABLE,
    });
    expect(store.slots.get(1)?.lockedBy).toBe(200);
  });

  it('Goi lai cung user tren cung slot la idempotent, khong tao giu cho moi (TC-BOOK-03)', async () => {
    const store: FakeStore = { slots: new Map([[1, availableSlot(1)]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);
    const now = new Date();

    const first = await manager.acquireLocks([1], 100, now);
    const second = await manager.acquireLocks([1], 100, now);

    expect(second.lockedSlots[0].alreadyLockedByRequester).toBe(true);
    expect(second.lockedSlots[0].lockExpiresAt.getTime()).toBe(
      first.lockedSlots[0].lockExpiresAt.getTime(),
    );
  });

  it('Lazy release: giu cho qua han duoc tam va cho user moi giu lai (TC-BOOK-04, muc 4.7.1)', async () => {
    const expired = availableSlot(1);
    const now = new Date();
    expired.lock(200, TTL_MINUTES, new Date(now.getTime() - 10 * 60_000));
    const store: FakeStore = { slots: new Map([[1, expired]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    const result = await manager.acquireLocks([1], 100, now);

    expect(result.lockedSlots[0].status).toBe(SlotStatus.LOCKED);
    expect(store.slots.get(1)?.lockedBy).toBe(100);
  });

  it('Slot BOOKED khong the bi giu cho (TC-BOOK-05)', async () => {
    const booked = availableSlot(1);
    booked.lock(500, TTL_MINUTES, new Date());
    booked.markBooked(9);
    const store: FakeStore = { slots: new Map([[1, booked]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(manager.acquireLocks([1], 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.SLOT_NOT_AVAILABLE,
    });
  });

  it('Slot qua thoi diem bat dau bi tu choi (TC-BOOK-06)', async () => {
    const past = availableSlot(1, { startOffsetHours: -2 });
    const store: FakeStore = { slots: new Map([[1, past]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(manager.acquireLocks([1], 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.SLOT_NOT_AVAILABLE,
    });
  });

  it('Slot khong ton tai tra SLOT_NOT_FOUND (TC-BOOK-07)', async () => {
    const store: FakeStore = { slots: new Map(), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(manager.acquireLocks([999], 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.SLOT_NOT_FOUND,
    });
  });

  it('Khoa nhieu slot theo thu tu slotId tang dan de tranh circular deadlock (muc 4.6.2)', async () => {
    const store: FakeStore = {
      slots: new Map([
        [7, availableSlot(7)],
        [3, availableSlot(3)],
        [5, availableSlot(5)],
      ]),
      saveCount: 0,
      lockOrder: [],
    };
    const { manager } = buildManager(store);

    const result = await manager.acquireLocks([7, 3, 5, 3], 100, new Date());

    expect(store.lockOrder).toEqual([3, 5, 7]);
    expect(result.lockedSlots.map((slot) => slot.slotId)).toEqual([3, 5, 7]);
  });

  it('Retry co gioi han khi MySQL tra deadlock errno 1213 (TC-BOOK-08)', async () => {
    const store: FakeStore = { slots: new Map([[1, availableSlot(1)]]), saveCount: 0, lockOrder: [] };
    const harness = buildManager(store, { transactionFails: 2 });

    const result = await harness.manager.acquireLocks([1], 100, new Date());

    expect(result.lockedSlots).toHaveLength(1);
    expect(harness.attempts).toBe(3);
  });

  it('Thu het van deadlock thi bao DEADLOCK_RETRY_EXHAUSTED, khong im lang that bai', async () => {
    const store: FakeStore = { slots: new Map([[1, availableSlot(1)]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store, { transactionFails: 99 });

    await expect(manager.acquireLocks([1], 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.DEADLOCK_RETRY_EXHAUSTED,
    });
  });

  it('releaseExpiredLocks tra so giu cho bi giai phong va khong dong vien BOOKED (TC-BOOK-09)', async () => {
    const now = new Date();
    const stale = availableSlot(1);
    stale.lock(200, TTL_MINUTES, new Date(now.getTime() - 9 * 60_000));
    const fresh = availableSlot(2);
    fresh.lock(200, TTL_MINUTES, now);
    const booked = availableSlot(3);
    booked.lock(500, TTL_MINUTES, now);
    booked.markBooked(5);
    const store: FakeStore = {
      slots: new Map([
        [1, stale],
        [2, fresh],
        [3, booked],
      ]),
      saveCount: 0,
      lockOrder: [],
    };
    const { manager } = buildManager(store);

    const released = await manager.releaseExpiredLocks(now);

    expect(released).toBe(1);
    expect(store.slots.get(1)?.status).toBe(SlotStatus.AVAILABLE);
    expect(store.slots.get(2)?.status).toBe(SlotStatus.LOCKED);
    expect(store.slots.get(3)?.status).toBe(SlotStatus.BOOKED);
  });

  it('releaseLock tu choi khi nguoi khong phai chu giu cho muong huy (TC-BOOK-10, muc 4.7.3)', async () => {
    const held = availableSlot(1);
    held.lock(200, TTL_MINUTES, new Date());
    const store: FakeStore = { slots: new Map([[1, held]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(manager.releaseLock(1, 100, new Date())).rejects.toMatchObject({
      code: DomainErrorCode.SLOT_NOT_LOCKED_BY_USER,
    });
  });

  it('assertLockHeld bat duoc truong hop giu cho da bi user khac thay the truoc khi confirm', async () => {
    const hijacked = availableSlot(1);
    hijacked.status = SlotStatus.LOCKED;
    hijacked.lockedBy = 777;
    hijacked.lockExpiresAt = new Date(Date.now() + 60_000);
    const store: FakeStore = { slots: new Map([[1, hijacked]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(
      manager.assertLockHeld({ id: 'tx' }, [1], 100, new Date()),
    ).rejects.toMatchObject({ code: DomainErrorCode.SLOT_NOT_LOCKED_BY_USER });
  });

  it('assertLockHeld bat duoc giu cho qua han luc confirm (TC-BOOK-11)', async () => {
    const expired = availableSlot(1);
    const now = new Date();
    expired.lock(100, TTL_MINUTES, new Date(now.getTime() - 6 * 60_000));
    const store: FakeStore = { slots: new Map([[1, expired]]), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(
      manager.assertLockHeld({ id: 'tx' }, [1], 100, now),
    ).rejects.toMatchObject({ code: DomainErrorCode.SLOT_LOCK_EXPIRED });
  });

  it('Tu choi yeu cau giu cho nhieu hon 8 slot (FR-02, gioi han tranh gian doi khoa)', async () => {
    const store: FakeStore = { slots: new Map(), saveCount: 0, lockOrder: [] };
    const { manager } = buildManager(store);

    await expect(
      manager.acquireLocks(Array.from({ length: 9 }, (_, i) => i + 1), 100, new Date()),
    ).rejects.toMatchObject({ code: DomainErrorCode.SLOT_NOT_AVAILABLE });
  });
});
