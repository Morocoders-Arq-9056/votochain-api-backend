import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager } from 'typeorm';

const storage = new AsyncLocalStorage<EntityManager | null>();

export const TransactionContext = {
  run<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
    return storage.run(manager, fn);
  },

  get current(): EntityManager | null {
    return storage.getStore() ?? null;
  },

  get manager(): EntityManager {
    const manager = storage.getStore();
    if (!manager) throw new Error('No active transaction — run inside UnitOfWork.run()');
    return manager;
  },
};
