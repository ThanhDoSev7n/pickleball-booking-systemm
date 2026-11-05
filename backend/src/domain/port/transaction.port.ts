/**
 * Port (interface) cho transaction - Dependency Inversion (muc 4.5.1).
 * Domain/application goi runInTransaction; Infrastructure (TypeORM) moi biet den EntityManager.
 * SlotLockManager nam toan bo logic SELECT ... FOR UPDATE (Hinh 4.3) ma van unit-test duoc bang fake.
 */
export const TRANSACTION_MANAGER = 'TRANSACTION_MANAGER';

/** Doi tuong dai dien cho mot transaction dang mo. Duoc truyen xuong repository cung phien ban. */
export interface TransactionHandle {
  readonly id: string;
}

export interface ITransactionManager {
  /**
   * Bat dau transaction (BEGIN), chay work, COMMIT neu thanh cong, ROLLBACK neu nem loi.
   * Mc tieu: giu khoa duoi 50 ms (muc 4.1.3) - khong duoc goi I/O ngoai le (notification, HTTP)
   * ben trong callback nay.
   */
  runInTransaction<T>(work: (tx: TransactionHandle) => Promise<T>): Promise<T>;
}
