import { randomUUID } from "node:crypto";

/**
 * Identity of one delivery order (`dlo-` prefixed).
 */
export class DeliveryOrderId {
  private constructor(public readonly value: string) {}

  static generate(): DeliveryOrderId {
    return new DeliveryOrderId(`dlo-${randomUUID()}`);
  }

  static of(v: string): DeliveryOrderId {
    if (!v?.trim()) throw new Error('invalid delivery order id');
    return new DeliveryOrderId(v);
  }

  equals(o: DeliveryOrderId): boolean { return this.value === o.value; }
}
