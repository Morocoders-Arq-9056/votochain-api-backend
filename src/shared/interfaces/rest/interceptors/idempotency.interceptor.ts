import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Observable } from 'rxjs';

/**
 * Interceptor that extracts the idempotency key from the request headers and attaches it to the request object.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly header: string;

  constructor(cfg: ConfigService) {
    this.header = cfg.get<string>('idempotency.header', 'Idempotency-Key')!;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const key = req.headers[this.header.toLowerCase()];
    if (key) req.idempotencyKey = key;
    return next.handle();
  }
}