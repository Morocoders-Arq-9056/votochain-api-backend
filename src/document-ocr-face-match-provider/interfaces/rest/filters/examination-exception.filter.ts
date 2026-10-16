import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ContactNotAllowedError } from '../../../domain/exceptions/contact-not-allowed.error.js';
import { ExaminationAlreadyOpenError } from '../../../domain/exceptions/examination-already-open.error.js';
import { ExaminationConcludedError } from '../../../domain/exceptions/examination-concluded.error.js';
import { NoEligibleMembershipError } from '../../../domain/exceptions/no-eligible-membership.error.js';
import { NoOpenExaminationError } from '../../../domain/exceptions/no-open-examination.error.js';

/**
 * Maps OCR domain rejections to HTTP statuses. Duplicate OPEN → 409; unknown
 * examination → 404; concluded/not-open → 422; membership/consent gates → 403.
 */
@Catch(
  ContactNotAllowedError,
  ExaminationAlreadyOpenError,
  ExaminationConcludedError,
  NoEligibleMembershipError,
  NoOpenExaminationError,
)
export class ExaminationExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof NoEligibleMembershipError
      || exception instanceof ContactNotAllowedError) status = 403;
    else if (exception instanceof NoOpenExaminationError) status = 404;
    else if (exception instanceof ExaminationConcludedError) status = 422;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
