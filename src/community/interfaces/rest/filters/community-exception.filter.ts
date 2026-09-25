import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AdminAlreadyAppointedError } from '../../../domain/exceptions/admin-already-appointed.error.js';
import { AdminNotHeldError } from '../../../domain/exceptions/admin-not-held.error.js';
import { ArchivedIsTerminalError } from '../../../domain/exceptions/archived-is-terminal.error.js';
import { CommunityAlreadyExistsError } from '../../../domain/exceptions/community-already-exists.error.js';
import { CommunityNotActiveError } from '../../../domain/exceptions/community-not-active.error.js';
import { CommunityNotFoundError } from '../../../domain/exceptions/community-not-found.error.js';
import { IllegalCommunityTransitionError } from '../../../domain/exceptions/illegal-community-transition.error.js';
import { LastAdministratorError } from '../../../domain/exceptions/last-administrator.error.js';
import { PersonUnknownError } from '../../../domain/exceptions/person-unknown.error.js';
import { PolicyUndefinedError } from '../../../domain/exceptions/policy-undefined.error.js';

/**
 * Maps Community domain rejections to HTTP statuses.
 * Unknown community/admin/person → 404; undefined policy → 422;
 * conflicts and terminal/illegal transitions → 409. Anything else
 * falls through to the global filter.
 */
@Catch(
  AdminAlreadyAppointedError,
  AdminNotHeldError,
  ArchivedIsTerminalError,
  CommunityAlreadyExistsError,
  CommunityNotActiveError,
  CommunityNotFoundError,
  IllegalCommunityTransitionError,
  LastAdministratorError,
  PersonUnknownError,
  PolicyUndefinedError,
)
export class CommunityExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof CommunityNotFoundError
      || exception instanceof AdminNotHeldError
      || exception instanceof PersonUnknownError) status = 404;
    else if (exception instanceof PolicyUndefinedError) status = 422;
    response.status(status).json({
      message: exception.message,
      statusCode: status,
    });
  }
}
