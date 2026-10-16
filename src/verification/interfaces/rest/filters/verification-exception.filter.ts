import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AlreadyAnsweredError } from '../../../domain/exceptions/already-answered.error.js';
import { AttemptNotHeldError } from '../../../domain/exceptions/attempt-not-held.error.js';
import { ChallengeElapsedError } from '../../../domain/exceptions/challenge-elapsed.error.js';
import { ContactNotAllowedError } from '../../../domain/exceptions/contact-not-allowed.error.js';
import { NoUsableChallengeError } from '../../../domain/exceptions/no-usable-challenge.error.js';
import { PurposeUnknownError } from '../../../domain/exceptions/purpose-unknown.error.js';

/**
 * Maps Verification domain rejections to HTTP statuses.
 * NoUsableChallenge/AttemptNotHeld → 404; answered-again races → 409;
 * elapsed validity window → 410; closed-purpose or contact refusals → 422.
 * Anything else falls through to the global filter.
 */
@Catch(
  AlreadyAnsweredError,
  AttemptNotHeldError,
  ChallengeElapsedError,
  ContactNotAllowedError,
  NoUsableChallengeError,
  PurposeUnknownError,
)
export class VerificationExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof NoUsableChallengeError || exception instanceof AttemptNotHeldError) status = 404;
    else if (exception instanceof ChallengeElapsedError) status = 410;
    else if (exception instanceof PurposeUnknownError || exception instanceof ContactNotAllowedError) status = 422;
    response.status(status).json({
      message: exception.message,
      statusCode: status,
    });
  }
}
