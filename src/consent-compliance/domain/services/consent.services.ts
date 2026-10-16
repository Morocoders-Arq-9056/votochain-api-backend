import type {
  ConfirmErasureRequestCommand,
  DefineRetentionPolicyCommand,
  GrantConsentCommand,
  RecordRevocationConfirmationCommand,
  RevokeConsentCommand,
  SubmitErasureRequestCommand,
} from "../model/commands/consent.commands.js";
import type { ConsentRecordId } from "../model/valueobjects/consent-record-id.value-object.js";
import type { DataSubjectRequestId } from "../model/valueobjects/data-subject-request-id.value-object.js";
import type { RetentionPolicyId } from "../model/valueobjects/retention-policy-id.value-object.js";
import type {
  GetAuditTrailByPersonQuery,
  GetConsentStateByPersonAndScopeQuery,
  GetErasureStandingByPersonQuery,
  GetRetentionTermsByCategoryQuery,
} from "../model/queries/consent.queries.js";

export const CONSENT_COMMAND_SERVICE = Symbol('CONSENT_COMMAND_SERVICE');

export interface ConsentCommandService {
  grantConsent(cmd: GrantConsentCommand): Promise<ConsentRecordId>;
  revokeConsent(cmd: RevokeConsentCommand): Promise<void>;
}

export const ERASURE_COMMAND_SERVICE = Symbol('ERASURE_COMMAND_SERVICE');

export interface ErasureCommandService {
  submitErasureRequest(cmd: SubmitErasureRequestCommand): Promise<DataSubjectRequestId>;
  confirmErasureRequest(cmd: ConfirmErasureRequestCommand): Promise<void>;
  recordRevocationConfirmation(cmd: RecordRevocationConfirmationCommand): Promise<void>;
}

export const RETENTION_COMMAND_SERVICE = Symbol('RETENTION_COMMAND_SERVICE');

export interface RetentionCommandService {
  defineRetentionPolicy(cmd: DefineRetentionPolicyCommand): Promise<RetentionPolicyId>;
}

export interface ConsentStateAnswer {
  granted: boolean;
  policyVersion: string;
  since: Date | null;
}

export interface ErasureStandingAnswer {
  standing: string;
  pending: string[];
  confirmed: string[];
}

export interface RetentionTermsAnswer {
  category: string;
  terms: Record<string, unknown>;
}

export interface AuditEntry {
  kind: string;
  at: string;
  detail: Record<string, string>;
}

export const CONSENT_QUERY_SERVICE = Symbol('CONSENT_QUERY_SERVICE');

export interface ConsentQueryService {
  getConsentStateByPersonAndScope(q: GetConsentStateByPersonAndScopeQuery): Promise<ConsentStateAnswer>;
  getAuditTrailByPerson(q: GetAuditTrailByPersonQuery): Promise<AuditEntry[]>;
}

export const ERASURE_QUERY_SERVICE = Symbol('ERASURE_QUERY_SERVICE');

export interface ErasureQueryService {
  getErasureStandingByPerson(q: GetErasureStandingByPersonQuery): Promise<ErasureStandingAnswer | null>;
  getRetentionTermsByCategory(q: GetRetentionTermsByCategoryQuery): Promise<RetentionTermsAnswer | null>;
}
