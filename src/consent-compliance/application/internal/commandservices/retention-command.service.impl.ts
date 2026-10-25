import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { RetentionPolicy } from "../../../domain/model/aggregates/retention-policy.aggregate.js";
import { DefineRetentionPolicyCommand } from "../../../domain/model/commands/consent.commands.js";
import { RetentionPolicyId } from "../../../domain/model/valueobjects/retention-policy-id.value-object.js";
import { PolicySupersedes } from "../../../domain/model/valueobjects/policy-supersedes.value-object.js";
import { RETENTION_REPOSITORY } from "../../../domain/repositories/retention.repository.js";
import type { RetentionRepository } from "../../../domain/repositories/retention.repository.js";
import { RetentionCommandService } from "../../../domain/services/consent.services.js";

@Injectable()
export class RetentionCommandServiceImpl implements RetentionCommandService {
  constructor(
    @Inject(RETENTION_REPOSITORY) private readonly policies: RetentionRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async defineRetentionPolicy(cmd: DefineRetentionPolicyCommand): Promise<RetentionPolicyId> {
    const policy = await this.uow.run(async () => {
      const latest = await this.policies.findLatestByCategory(cmd.category);
      const created = RetentionPolicy.define({
        id: RetentionPolicyId.generate(),
        category: cmd.category,
        terms: cmd.terms,
        supersedes: latest ? PolicySupersedes.of(latest.id.value) : cmd.supersedes,
      });
      await this.policies.save(created);
      return created;
    });
    for (const e of policy.pullDomainEvents()) this.events.emit(e.eventName, e);
    return policy.id;
  }
}
