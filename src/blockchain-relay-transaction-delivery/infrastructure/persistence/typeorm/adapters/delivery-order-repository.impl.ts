import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { SignedContentRef } from "../../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { DeliveryOrder } from "../../../../domain/model/aggregates/delivery-order.aggregate.js";
import { DeliveryStanding } from "../../../../domain/model/valueobjects/delivery-standing.value-object.js";
import { DeliveryOrderId } from "../../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../../../../domain/model/valueobjects/payer-ref.value-object.js";
import { SendingOrderPosition } from "../../../../domain/model/valueobjects/sending-order-position.value-object.js";
import { OrderAlreadyAcceptedError } from "../../../../domain/exceptions/order-already-accepted.error.js";
import type { DeliveryOrderRepository } from "../../../../domain/repositories/delivery-order.repository.js";
import { DeliveryPersistenceAssembler } from "../assemblers/delivery-persistence.assembler.js";
import { DeliveryOrderOrmEntity } from "../entities/delivery.orm-entities.js";

const OPEN_STANDINGS = [DeliveryStanding.ACCEPTED, DeliveryStanding.ORDERED, DeliveryStanding.SENT, DeliveryStanding.FAILED, DeliveryStanding.RETRIED];

@Injectable()
export class DeliveryOrderRepositoryImpl implements DeliveryOrderRepository {
  constructor(
    @InjectRepository(DeliveryOrderOrmEntity) private readonly orm: Repository<DeliveryOrderOrmEntity>,
    private readonly assembler: DeliveryPersistenceAssembler,
  ) {}

  private get repository(): Repository<DeliveryOrderOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(DeliveryOrderOrmEntity) : this.orm;
  }

  async findById(id: DeliveryOrderId): Promise<DeliveryOrder | null> {
    const found = await this.repository.findOne({ where: { id: id.value }, relations: { attempts: true } });
    return found ? this.assembler.toDomain(found) : null;
  }

  async findOpenByContent(content: SignedContentRef): Promise<DeliveryOrder | null> {
    const found = await this.repository.createQueryBuilder('o')
      .leftJoinAndSelect('o.attempts', 'a')
      .where('o.contentRef = :content', { content: content.value })
      .andWhere('o.standing IN (:...open)', { open: OPEN_STANDINGS })
      .getOne();
    return found ? this.assembler.toDomain(found) : null;
  }

  async findByPayer(payer: PayerRef): Promise<DeliveryOrder[]> {
    const found = await this.repository.find({
      where: { payerRef: payer.value },
      relations: { attempts: true },
      order: { orderPosition: 'ASC' },
    });
    return found.map((e) => this.assembler.toDomain(e));
  }

  async nextPositionForPayer(payer: PayerRef): Promise<SendingOrderPosition> {
    const raw = await this.repository.createQueryBuilder('o')
      .select('MAX(o.orderPosition)', 'max')
      .where('o.payerRef = :payer', { payer: payer.value })
      .getRawOne<{ max: number | null }>();
    return SendingOrderPosition.of((raw?.max ?? -1) + 1);
  }

  async save(order: DeliveryOrder): Promise<void> {
    try {
      const orm = this.assembler.toOrm(order);
      await this.repository.save(orm);
    } catch (e) {
      if (e instanceof QueryFailedError && (e as unknown as { code?: string }).code === '23505') {
        throw new OrderAlreadyAcceptedError();
      }
      throw e;
    }
  }
}
