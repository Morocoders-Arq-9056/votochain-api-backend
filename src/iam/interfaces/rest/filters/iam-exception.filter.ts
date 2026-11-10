import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AddressAlreadyHeldError } from '../../../domain/exceptions/address-already-held.error.js';
import { AlreadyRegisteredError } from '../../../domain/exceptions/already-registered.error.js';
import { IllegalUserStateError } from '../../../domain/exceptions/illegal-user-state.error.js';
import { LastAdminRefusedError } from '../../../domain/exceptions/last-admin-refused.error.js';
import { LastProofRefusedError } from '../../../domain/exceptions/last-proof-refused.error.js';
import { NoOpenSessionError } from '../../../domain/exceptions/no-open-session.error.js';
import { OutsideProofAlreadyLinkedError } from '../../../domain/exceptions/outside-proof-already-linked.error.js';
import { ProofNotHeldError } from '../../../domain/exceptions/proof-not-held.error.js';
import { RoleAlreadyHeldError } from '../../../domain/exceptions/role-already-held.error.js';
import { RoleNotHeldError } from '../../../domain/exceptions/role-not-held.error.js';
import { SuspendedRefusedError } from '../../../domain/exceptions/suspended-refused.error.js';
import { InvalidCredentialsError } from '../../../domain/exceptions/invalid-credentials.error.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';

/**
 * Maps IAM domain rejections to HTTP statuses.
 * InvalidCredentials → 401 with a single message (address existence is
 * never revealed); UserNotFound → 404; illegal state transitions → 422;
 * every other guard refusal → 409. Anything else falls through.
 */
@Catch(
  AddressAlreadyHeldError,
  AlreadyRegisteredError,
  IllegalUserStateError,
  InvalidCredentialsError,
  LastAdminRefusedError,
  LastProofRefusedError,
  NoOpenSessionError,
  OutsideProofAlreadyLinkedError,
  ProofNotHeldError,
  RoleAlreadyHeldError,
  RoleNotHeldError,
  SuspendedRefusedError,
  UserNotFoundError,
)
export class IamExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof InvalidCredentialsError) status = 401;
    else if (exception instanceof UserNotFoundError) status = 404;
    else if (exception instanceof IllegalUserStateError) status = 422;
    response.status(status).json({
      message: exception.message,
      statusCode: status,
    });
  }
}
