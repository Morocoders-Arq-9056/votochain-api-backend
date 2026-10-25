export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface IUnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>;
  /**
   * Runs `fn` in a transaction, then executes `afterCommit` ONLY after the
   * commit succeeds. Publication belongs here — never inside `fn`, never
   * before `run()` resolves. A crash between commit and `afterCommit` can
   * still lose events: the full fix is a transactional outbox table
   * (write events in `fn`, relay afterwards). This hook is the migration
   * seam toward that outbox.
   */
  runWithAfterCommit<T>(fn: () => Promise<T>, afterCommit: (result: T) => Promise<void> | void): Promise<T>;
}
