import { Global, Module } from '@nestjs/common';
import { UNIT_OF_WORK } from './domain/repositories/unit-of-work.js';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm/repositories/unit-of-work.impl.js';

@Global()
@Module({
  providers: [{ provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork }],
  exports: [UNIT_OF_WORK],
})
export class SharedModule {}
