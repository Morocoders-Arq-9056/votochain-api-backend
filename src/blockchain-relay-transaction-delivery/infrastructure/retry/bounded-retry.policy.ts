import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RetryPolicy } from "../../domain/services/delivery-policies.service.js";

/**
 * Bounded production retry: at most `RELAY_MAX_RETRIES` (default 5) sending
 * attempts. Test double: `NoRetryPolicy` (single try).
 */
@Injectable()
export class BoundedRetryPolicy implements RetryPolicy {
  constructor(private readonly config: ConfigService) {}

  shouldRetry(attempts: number): boolean {
    const max = this.config.get<number>('relay.retryMax', 5);
    return attempts < max;
  }
}

@Injectable()
export class NoRetryPolicy implements RetryPolicy {
  shouldRetry(): boolean { return false; }
}
