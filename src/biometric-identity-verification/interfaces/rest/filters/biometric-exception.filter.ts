import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AttemptConcludedError } from '../../../domain/exceptions/attempt-concluded.error.js';
import { ConsentRequiredError } from '../../../domain/exceptions/consent-required.error.js';
import { LivenessRequiredError } from '../../../domain/exceptions/liveness-required.error.js';
import { ReferenceAlreadyExistsError } from '../../../domain/exceptions/reference-already-exists.error.js';
import { ReferenceEndedError } from '../../../domain/exceptions/reference-ended.error.js';
import { ReferenceRequiredError } from '../../../domain/exceptions/reference-required.error.js';

/**
 * Maps Biometric domain rejections to HTTP statuses. Unknown profile/attempt
 * → 404; consent → 403; one-live violation/illegal sequence → 409;
 * out-of-order comparison/revoked reference → 422.
 */
@Catch(
  AttemptConcludedError,
  ConsentRequiredError,
  LivenessRequiredError,
  ReferenceAlreadyExistsError,
  ReferenceEndedError,
  ReferenceRequiredError,
)
export class BiometricExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof ConsentRequiredError) status = 403;
    else if (exception instanceof ReferenceRequiredError) status = 404;
    else if (exception instanceof LivenessRequiredError || exception instanceof ReferenceEndedError) status = 422;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
