import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { CommunityNotAcceptingMembersError } from '../../../domain/exceptions/community-not-accepting-members.error.js';
import { IllegalMembershipTransitionError } from '../../../domain/exceptions/illegal-membership-transition.error.js';
import { MembershipAlreadyExistsError } from '../../../domain/exceptions/membership-already-exists.error.js';
import { MembershipNotFoundError } from '../../../domain/exceptions/membership-not-found.error.js';
import { PersonUnknownError } from '../../../domain/exceptions/person-unknown.error.js';
import { RoleRequiresActiveError } from '../../../domain/exceptions/role-requires-active.error.js';
import { TerminationIsTerminalError } from '../../../domain/exceptions/termination-is-terminal.error.js';

/**
 * Maps Membership domain rejections to HTTP statuses. Unknown membership or
 * unknown person → 404; closed community → 422; live-pair conflicts, illegal
 * transitions, role-without-ACTIVE and terminal violations → 409. Anything
 * else falls through to the global filter.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Catch(
  CommunityNotAcceptingMembersError,
  IllegalMembershipTransitionError,
  MembershipAlreadyExistsError,
  MembershipNotFoundError,
  PersonUnknownError,
  RoleRequiresActiveError,
  TerminationIsTerminalError,
)
export class MembershipExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof MembershipNotFoundError) status = 404;
    else if (exception instanceof PersonUnknownError) status = 404;
    else if (exception instanceof CommunityNotAcceptingMembersError) status = 422;
    response.status(status).json({
      message: exception.message,
      statusCode: status,
    });
  }
}
