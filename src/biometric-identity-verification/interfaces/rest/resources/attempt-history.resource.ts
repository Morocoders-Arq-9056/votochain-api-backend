import { AttemptResource } from './attempt.resource.js';

/** Attempt history envelope. */
export class AttemptHistoryResource {
  constructor(public readonly items: AttemptResource[]) {}
}
