import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ConsentAlreadyGrantedError } from '../../../domain/exceptions/consent-already-granted.error.js';
import { ConsentNotGrantedError } from '../../../domain/exceptions/consent-not-granted.error.js';
import { ErasureAlreadyOpenError } from '../../../domain/exceptions/erasure-already-open.error.js';
import { ErasureIncompleteError } from '../../../domain/exceptions/erasure-incomplete.error.js';
import { ErasureNotConfirmedError } from '../../../domain/exceptions/erasure-not-confirmed.error.js';
import { RequestNotFoundError } from '../../../domain/exceptions/request-not-found.error.js';
import { UnknownOwnerConfirmationError } from '../../../domain/exceptions/unknown-owner-confirmation.error.js';

/**
 * Maps Consent domain rejections to HTTP statuses. Unknown requests â†’ 404;
 * unknown owners â†’ 422; duplicate/open/incomplete guards â†’ 409.
 */
@Catch(
  RequestNotFoundError,
  UnknownOwnerConfirmationError,
  ConsentAlreadyGrantedError,
  ConsentNotGrantedError,
  ErasureAlreadyOpenError,
  ErasureNotConfirmedError,
  ErasureIncompleteError,
)
export class ConsentExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof RequestNotFoundError) status = 404;
    else if (exception instanceof UnknownOwnerConfirmationError) status = 422;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
