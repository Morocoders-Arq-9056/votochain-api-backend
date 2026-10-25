import { PersonId } from '../../../../src/shared/domain/model/valueobjects/person-id.value-object.js';
import { ConsentRecord } from '../../../../src/consent-compliance/domain/model/aggregates/consent-record.aggregate.js';
import { DataSubjectRequest } from '../../../../src/consent-compliance/domain/model/aggregates/data-subject-request.aggregate.js';
import { RetentionPolicy } from '../../../../src/consent-compliance/domain/model/aggregates/retention-policy.aggregate.js';
import { ConsentRecordId } from '../../../../src/consent-compliance/domain/model/valueobjects/consent-record-id.value-object.js';
import { ERASURE_OWNERS } from '../../../../src/consent-compliance/domain/model/valueobjects/consent-standings.value-object.js';
import { ErasureOwner } from '../../../../src/consent-compliance/domain/model/valueobjects/erasure-owner.value-object.js';
import { PolicySupersedes } from '../../../../src/consent-compliance/domain/model/valueobjects/policy-supersedes.value-object.js';
import { ConsentScope } from '../../../../src/consent-compliance/domain/model/valueobjects/consent-scope.value-object.js';
import { DataCategory } from '../../../../src/consent-compliance/domain/model/valueobjects/data-category.value-object.js';
import { DataSubjectRequestId } from '../../../../src/consent-compliance/domain/model/valueobjects/data-subject-request-id.value-object.js';
import { PolicyVersion } from '../../../../src/consent-compliance/domain/model/valueobjects/policy-version.value-object.js';
import { RetentionPolicyId } from '../../../../src/consent-compliance/domain/model/valueobjects/retention-policy-id.value-object.js';
import { RetentionTerms } from '../../../../src/consent-compliance/domain/model/valueobjects/retention-terms.value-object.js';
import { RevocationConfirmations } from '../../../../src/consent-compliance/domain/model/valueobjects/revocation-confirmations.value-object.js';
import { ConsentNotGrantedError } from '../../../../src/consent-compliance/domain/exceptions/consent-not-granted.error.js';
import { ErasureIncompleteError } from '../../../../src/consent-compliance/domain/exceptions/erasure-incomplete.error.js';
import { UnknownOwnerConfirmationError } from '../../../../src/consent-compliance/domain/exceptions/unknown-owner-confirmation.error.js';

const PERSON = 'per-test-1';

function grant(): ConsentRecord {
  return ConsentRecord.grant({
    id: ConsentRecordId.generate(),
    personId: PersonId.of(PERSON),
    scope: ConsentScope.of('BIOMETRIC_PROCESSING'),
    policyVersion: PolicyVersion.of('v2026.01'),
  });
}

function submit(): DataSubjectRequest {
  return DataSubjectRequest.submit({
    id: DataSubjectRequestId.generate(),
    personId: PersonId.of(PERSON),
    confirmations: new RevocationConfirmations([]),
  });
}

describe('ConsentRecord aggregate', () => {
  it('grants GRANTED and revokes once (re-revoke refused)', () => {
    const r = grant();
    expect(r.answerState().granted).toBe(true);
    r.revoke();
    expect(r.answerState().granted).toBe(false);
    expect(() => r.revoke()).toThrow(ConsentNotGrantedError);
  });
});

describe('DataSubjectRequest aggregate', () => {
  it('flows submit → confirm → coordinate → 4 confirmations → complete', () => {
    const r = submit();
    r.confirm();
    r.coordinateRevocation(ERASURE_OWNERS.map((o) => ErasureOwner.of(o)));
    expect(r.answerStanding().standing).toBe('AWAITING_CONFIRMATIONS');
    expect(r.answerStanding().pending).toHaveLength(4);
    for (const owner of ERASURE_OWNERS) r.recordConfirmation(ErasureOwner.of(owner));
    r.complete();
    expect(r.answerStanding().standing).toBe('COMPLETED');
  });

  it('refuses completion while owners remain (no partial completion)', () => {
    const r = submit();
    r.confirm();
    r.coordinateRevocation(ERASURE_OWNERS.map((o) => ErasureOwner.of(o)));
    r.recordConfirmation(ErasureOwner.of('biometric'));
    expect(() => r.complete()).toThrow(ErasureIncompleteError);
  });

  it('rejects confirmations from never-coordinated owners', () => {
    const r = submit();
    r.confirm();
    r.coordinateRevocation(ERASURE_OWNERS.map((o) => ErasureOwner.of(o)));
    expect(() => r.recordConfirmation({ value: 'unknown-owner' } as ErasureOwner)).toThrow(UnknownOwnerConfirmationError);
    expect(() => ErasureOwner.of('unknown-owner')).toThrow('invalid erasure owner');
  });

  it('re-grant is a new record (revoked records never reopen)', () => {
    const first = grant();
    first.revoke();
    const second = grant();
    expect(second.id.equals(first.id)).toBe(false);
    expect(second.answerState().granted).toBe(true);
  });
});

describe('RetentionPolicy aggregate', () => {
  it('defines with a supersede chain (never edits the past)', () => {
    const first = RetentionPolicy.define({
      id: RetentionPolicyId.generate(),
      category: DataCategory.of('biometric-reference'),
      terms: RetentionTerms.of({ months: 12 }),
      supersedes: null,
    });
    const second = RetentionPolicy.define({
      id: RetentionPolicyId.generate(),
      category: DataCategory.of('biometric-reference'),
      terms: RetentionTerms.of({ months: 6 }),
      supersedes: PolicySupersedes.of(first.id.value),
    });
    expect(second.supersedes?.value).toBe(first.id.value);
    expect(second.answerTerms().category).toBe('biometric-reference');
  });
});
