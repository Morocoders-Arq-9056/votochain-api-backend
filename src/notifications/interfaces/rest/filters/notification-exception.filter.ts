import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AddressMalformedError } from '../../../domain/exceptions/address-malformed.error.js';
import { AlreadyConfirmedError } from '../../../domain/exceptions/already-confirmed.error.js';
import { ContactNotAllowedError } from '../../../domain/exceptions/contact-not-allowed.error.js';
import { DispatchNotFoundError } from '../../../domain/exceptions/dispatch-not-found.error.js';
import { DuplicateIntentError } from '../../../domain/exceptions/duplicate-intent.error.js';
import { NoSendInstructedError } from '../../../domain/exceptions/no-send-instructed.error.js';
import { RetryNotAllowedError } from '../../../domain/exceptions/retry-not-allowed.error.js';
import { TemplateUnknownError } from '../../../domain/exceptions/template-unknown.error.js';

/**
 * Maps Notifications domain rejections to HTTP statuses.
 * Unknown dispatch → 404; malformed address → 400; consent refusal → 403;
 * unknown template or no send instructed → 422; duplicate intent, already
 * confirmed and retry-not-allowed → 409. Anything else falls through to the
 * global filter.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Catch(
  AddressMalformedError,
  AlreadyConfirmedError,
  ContactNotAllowedError,
  DispatchNotFoundError,
  DuplicateIntentError,
  NoSendInstructedError,
  RetryNotAllowedError,
  TemplateUnknownError,
)
export class NotificationExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof DispatchNotFoundError) status = 404;
    else if (exception instanceof AddressMalformedError) status = 400;
    else if (exception instanceof ContactNotAllowedError) status = 403;
    else if (exception instanceof TemplateUnknownError
      || exception instanceof NoSendInstructedError) status = 422;
    response.status(status).json({
      message: exception.message,
      statusCode: status,
    });
  }
}
