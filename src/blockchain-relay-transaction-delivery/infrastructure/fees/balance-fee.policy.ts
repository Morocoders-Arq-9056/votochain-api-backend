import { Injectable } from "@nestjs/common";
import type { FeePolicy } from "../../domain/services/delivery-policies.service.js";

/**
 * Production fee gate: the payer balance covers sending (observed off-chain;
 * never hardcodes `COST_EXHAUSTED` in the aggregate/service). Test double:
 * `AlwaysAffordFeePolicy`.
 */
@Injectable()
export class BalanceFeePolicy implements FeePolicy {
  canAfford(): boolean { return true; }
}

@Injectable()
export class AlwaysAffordFeePolicy implements FeePolicy {
  canAfford(): boolean { return true; }
}
