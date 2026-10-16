import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ConsentRecordId } from "../valueobjects/consent-record-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { PolicyVersion } from "../valueobjects/policy-version.value-object.js";
import { ConsentStanding } from "../valueobjects/consent-standings.value-object.js";
import { ConsentNotGrantedError } from "../../exceptions/consent-not-granted.error.js";
import { ConsentGrantedEvent, ConsentRevokedEvent } from "../events/consent.events.js";

/**
 * One grant for one (person, scope) under one policy version.
 * Re-grant is a new record â€” a revoked record never reopens.
 */
export class ConsentRecord extends AggregateRoot {
  private constructor(
    private readonly _id: ConsentRecordId,
    private readonly _personId: PersonId,
    private readonly _scope: ConsentScope,
    private _standing: ConsentStanding,
    private readonly _policyVersion: PolicyVersion,
    private readonly _grantedAt: Date,
  ) { super(); }

  static grant(p: { id: ConsentRecordId; personId: PersonId; scope: ConsentScope; policyVersion: PolicyVersion }): ConsentRecord {
    const r = new ConsentRecord(p.id, p.personId, p.scope, ConsentStanding.GRANTED, p.policyVersion, new Date());
    r.registerEvent(new ConsentGrantedEvent(r._id, r._personId, r._scope, r._policyVersion));
    return r;
  }

  static rehydrate(p: { id: ConsentRecordId; personId: PersonId; scope: ConsentScope; standing: ConsentStanding; policyVersion: PolicyVersion; grantedAt: Date }): ConsentRecord {
    return new ConsentRecord(p.id, p.personId, p.scope, p.standing, p.policyVersion, p.grantedAt);
  }

  revoke(): void {
    if (this._standing !== ConsentStanding.GRANTED) throw new ConsentNotGrantedError('only a granted consent can be revoked');
    this._standing = ConsentStanding.REVOKED;
    this.registerEvent(new ConsentRevokedEvent(this._id, this._personId, this._scope));
  }

  answerState(): { granted: boolean; policyVersion: string; since: Date } {
    return { granted: this._standing === ConsentStanding.GRANTED, policyVersion: this._policyVersion.value, since: this._grantedAt };
  }

  get id(): ConsentRecordId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get scope(): ConsentScope { return this._scope; }
  get standing(): ConsentStanding { return this._standing; }
}
