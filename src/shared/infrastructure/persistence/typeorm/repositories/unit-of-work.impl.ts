import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { IUnitOfWork } from '../../../../domain/repositories/unit-of-work.js';
import { TransactionContext } from './transaction-context.js';

@Injectable()
export class TypeOrmUnitOfWork implements IUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await TransactionContext.run(runner.manager, fn);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
