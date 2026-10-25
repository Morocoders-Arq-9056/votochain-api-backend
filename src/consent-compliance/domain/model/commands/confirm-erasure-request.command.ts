import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";

export class ConfirmErasureRequestCommand {
  constructor(public readonly requestId: DataSubjectRequestId) {
    if (!requestId) throw new Error('requestId required');
  }
}
