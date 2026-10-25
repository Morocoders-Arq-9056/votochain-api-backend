import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";
import { ErasureOwner } from "../valueobjects/erasure-owner.value-object.js";

export class RecordRevocationConfirmationCommand {
  constructor(public readonly requestId: DataSubjectRequestId, public readonly owner: ErasureOwner) {
    if (!requestId || !owner) throw new Error('requestId+owner required');
  }
}
