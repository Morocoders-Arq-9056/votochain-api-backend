import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { IDEMPOTENCY_KEY_STORE, type IdempotencyKeyStore } from "../../../../application/internal/outboundservices/idempotency/idempotency-key-store.service.js";
import { RequestLogOrmEntity } from "../entities/request-log.orm-entity.js";

/**
 * TypeORM implementation of the {@link IdempotencyKeyStore} application port
 * (transport dedup for POST /votes, application layer only).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class RequestLogIdempotencyAdapter implements IdempotencyKeyStore {
  constructor(@InjectRepository(RequestLogOrmEntity) private readonly orm: Repository<RequestLogOrmEntity>) {}

  private get repository(): Repository<RequestLogOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(RequestLogOrmEntity) : this.orm;
  }

  async findVoteIdByKey(key: string): Promise<string | null> {
    const found = await this.repository.findOne({ where: { idempotencyKey: key } });
    return found ? found.voteId : null;
  }

  async saveVoteId(key: string, voteId: string): Promise<void> {
    const orm = new RequestLogOrmEntity();
    orm.idempotencyKey = key;
    orm.voteId = voteId;
    await this.repository.save(orm);
  }
}
