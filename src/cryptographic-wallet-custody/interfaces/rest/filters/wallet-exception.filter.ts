import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { CapabilityAlreadyExistsError } from '../../../domain/exceptions/capability-already-exists.error.js';
import { CapabilityNotFoundError } from '../../../domain/exceptions/capability-not-found.error.js';
import { IllegalWalletStateError } from '../../../domain/exceptions/illegal-wallet-state.error.js';

/**
 * Maps Wallet domain rejections to HTTP statuses. Unknown capability → 404;
 * duplicate capability/illegal sequence → 409; illegal state (suspended,
 * retired, not provisioned, position) → 422.
 */
@Catch(CapabilityAlreadyExistsError, CapabilityNotFoundError, IllegalWalletStateError)
export class WalletExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof CapabilityNotFoundError) status = 404;
    else if (exception instanceof IllegalWalletStateError) status = 422;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
