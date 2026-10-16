import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import {
  ConfirmErasureRequestCommand,
  DefineRetentionPolicyCommand,
  GrantConsentCommand,
  RecordRevocationConfirmationCommand,
  RevokeConsentCommand,
  SubmitErasureRequestCommand,
} from "../../../domain/model/commands/consent.commands.js";
import {
  GetAuditTrailByPersonQuery,
  GetConsentStateByPersonAndScopeQuery,
  GetErasureStandingByPersonQuery,
  GetRetentionTermsByCategoryQuery,
} from "../../../domain/model/queries/consent.queries.js";
import { ConsentScope } from "../../../domain/model/valueobjects/consent-scope.value-object.js";
import { DataCategory } from "../../../domain/model/valueobjects/data-category.value-object.js";
import { DataSubjectRequestId } from "../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { PolicyVersion } from "../../../domain/model/valueobjects/policy-version.value-object.js";
import { RetentionTerms } from "../../../domain/model/valueobjects/retention-terms.value-object.js";
import type {
  DefineRetentionPolicyResource,
  GrantConsentResource,
  RecordRevocationConfirmationResource,
  RevokeConsentResource,
  SubmitErasureRequestResource,
} from "../resources/consent.resource.js";

export class ConsentCommandFromResourceAssembler {
  static toGrantCommand(r: GrantConsentResource): GrantConsentCommand {
    return new GrantConsentCommand(PersonId.of(r.personId), ConsentScope.of(r.scope), PolicyVersion.of(r.policyVersion));
  }

  static toRevokeCommand(scope: string, r: RevokeConsentResource): RevokeConsentCommand {
    return new RevokeConsentCommand(PersonId.of(r.personId), ConsentScope.of(scope));
  }

  static toSubmitCommand(r: SubmitErasureRequestResource): SubmitErasureRequestCommand {
    return new SubmitErasureRequestCommand(PersonId.of(r.personId));
  }

  static toConfirmCommand(id: string): ConfirmErasureRequestCommand {
    return new ConfirmErasureRequestCommand(DataSubjectRequestId.of(id));
  }

  static toRecordConfirmationCommand(id: string, r: RecordRevocationConfirmationResource): RecordRevocationConfirmationCommand {
    return new RecordRevocationConfirmationCommand(DataSubjectRequestId.of(id), r.owner);
  }

  static toDefinePolicyCommand(r: DefineRetentionPolicyResource): DefineRetentionPolicyCommand {
    return new DefineRetentionPolicyCommand(
      DataCategory.of(r.category),
      RetentionTerms.of(r.terms ?? {}),
      r.supersedes ?? null,
    );
  }
}

export class ConsentParamsAssembler {
  static toStateQuery(personId: string, scope: string): GetConsentStateByPersonAndScopeQuery {
    return new GetConsentStateByPersonAndScopeQuery(PersonId.of(personId), ConsentScope.of(scope));
  }

  static toErasureStandingQuery(personId: string): GetErasureStandingByPersonQuery {
    return new GetErasureStandingByPersonQuery(PersonId.of(personId));
  }

  static toRetentionTermsQuery(category: string): GetRetentionTermsByCategoryQuery {
    return new GetRetentionTermsByCategoryQuery(DataCategory.of(category));
  }

  static toAuditTrailQuery(personId: string): GetAuditTrailByPersonQuery {
    return new GetAuditTrailByPersonQuery(PersonId.of(personId));
  }
}
