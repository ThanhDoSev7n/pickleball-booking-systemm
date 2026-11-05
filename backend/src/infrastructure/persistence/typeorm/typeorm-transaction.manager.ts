import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  ITransactionManager,
  TransactionHandle,
} from '../../../domain/port/transaction.port';

/**
 * Adapter cua ITransactionManager.
 * Transaction duoc mo bang DataSource.transaction() voi REPEATABLE READ mac dinh cua InnoDB
 * (ADR-001 / muc 4.6.2). Repository cung phien ban lay EntityManager qua resolve().
 */
@Injectable()
export class TypeOrmTransactionManager implements ITransactionManager {
  private readonly activeHandles = new Map<string, EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  async runInTransaction<T>(work: (tx: TransactionHandle) => Promise<T>): Promise<T> {
    const handle: TransactionHandle = { id: randomUUID() };
    return this.dataSource.transaction(async (entityManager) => {
      this.activeHandles.set(handle.id, entityManager);
      try {
        return await work(handle);
      } finally {
        this.activeHandles.delete(handle.id);
      }
    });
  }

  /** tx === null dung connection pool thong thuong (khong khoa). */
  resolve(tx: TransactionHandle | null): EntityManager {
    if (tx === null) {
      return this.dataSource.manager;
    }
    const entityManager = this.activeHandles.get(tx.id);
    if (entityManager === undefined) {
      throw new Error(
        `Transaction ${tx.id} khong hoac khong con dang mo. Repository co tx phai duoc goi ben trong runInTransaction.`,
      );
    }
    return entityManager;
  }
}
