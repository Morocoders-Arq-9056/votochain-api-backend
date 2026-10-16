import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionContext } from "../../../../../shared/infrastructure/persistence/typeorm/repositories/transaction-context.js";
import { DocumentExamination } from "../../../../domain/model/aggregates/document-examination.aggregate.js";
import { DocumentRef } from "../../../../domain/model/valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../../../../domain/model/valueobjects/examination-id.value-object.js";
import { ExaminationStanding } from "../../../../domain/model/valueobjects/examination-standing.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import type { ExaminationRepository } from "../../../../domain/repositories/examination.repository.js";
import { ExaminationPersistenceAssembler } from "../assemblers/examination-persistence.assembler.js";
import { ExaminationOrmEntity } from "../entities/examination.orm-entity.js";

/**
 * TypeORM implementation of the {@link ExaminationRepository} port. Joins
 * the running UoW transaction via TransactionContext when present.
 */
@Injectable()
export class ExaminationRepositoryImpl implements ExaminationRepository {
  constructor(
    @InjectRepository(ExaminationOrmEntity) private readonly orm: Repository<ExaminationOrmEntity>,
    private readonly assembler: ExaminationPersistenceAssembler,
  ) {}

  private get repository(): Repository<ExaminationOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(ExaminationOrmEntity) : this.orm;
  }

  async findById(id: ExaminationId): Promise<DocumentExamination | null> {
    const found = await this.repository.findOne({ where: { id: id.value } });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findOpenByPersonAndDocument(personId: PersonId, documentRef: DocumentRef): Promise<DocumentExamination | null> {
    const found = await this.repository.findOne({
      where: { personId: personId.value, documentRef: documentRef.value, standing: ExaminationStanding.OPEN },
    });
    return found ? this.assembler.toDomainFromOrm(found) : null;
  }

  async findAllByPersonAndDocument(personId: PersonId, documentRef: DocumentRef): Promise<DocumentExamination[]> {
    const found = await this.repository.find({
      where: { personId: personId.value, documentRef: documentRef.value },
      order: { requestedAt: 'DESC' },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async findAllByPerson(personId: PersonId): Promise<DocumentExamination[]> {
    const found = await this.repository.find({
      where: { personId: personId.value },
      order: { requestedAt: 'DESC' },
    });
    return found.map((e) => this.assembler.toDomainFromOrm(e));
  }

  async save(examination: DocumentExamination): Promise<void> {
    await this.repository.save(this.assembler.toOrmFromDomain(examination));
  }
}
