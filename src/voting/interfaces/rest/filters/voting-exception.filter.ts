import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AuthorizationAlreadyConsumedError } from '../../../domain/exceptions/authorization-already-consumed.error.js';
import { AuthorizationExpiredError } from '../../../domain/exceptions/authorization-expired.error.js';
import { AuthorizationNotFoundError } from '../../../domain/exceptions/authorization-not-found.error.js';
import { DuplicatePendingAuthorizationError } from '../../../domain/exceptions/duplicate-pending-authorization.error.js';
import { IllegalProposalTransitionError } from '../../../domain/exceptions/illegal-proposal-transition.error.js';
import { InvalidChoiceError } from '../../../domain/exceptions/invalid-choice.error.js';
import { ProposalNotFoundError } from '../../../domain/exceptions/proposal-not-found.error.js';
import { ProposalNotOpenError } from '../../../domain/exceptions/proposal-not-open.error.js';
import { ReplayRejectedError } from '../../../domain/exceptions/replay-rejected.error.js';
import { SignerMismatchError } from '../../../domain/exceptions/signer-mismatch.error.js';
import { VoteNotFoundError } from '../../../domain/exceptions/vote-not-found.error.js';
import { CapabilityNotFoundError } from '../../../../cryptographic-wallet-custody/domain/exceptions/capability-not-found.error.js';

/**
 * Maps Voting domain rejections to HTTP statuses. Late votes (proposal not
 * open) → 422 `LateVoteRejected`; signer/choice → 422; replay/consumed →
 * 409; expired → 410; unknown ids → 404; illegal transitions → 409.
 * A missing signing capability (custody) also maps to 404: the person
 * cannot vote until a wallet is provisioned.
 */
@Catch(
  AuthorizationAlreadyConsumedError,
  AuthorizationExpiredError,
  AuthorizationNotFoundError,
  CapabilityNotFoundError,
  DuplicatePendingAuthorizationError,
  IllegalProposalTransitionError,
  InvalidChoiceError,
  ProposalNotFoundError,
  ProposalNotOpenError,
  ReplayRejectedError,
  SignerMismatchError,
  VoteNotFoundError,
)
export class VotingExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof ProposalNotOpenError
      || exception instanceof InvalidChoiceError
      || exception instanceof SignerMismatchError) status = 422;
    else if (exception instanceof AuthorizationExpiredError) status = 410;
    else if (exception instanceof AuthorizationNotFoundError
      || exception instanceof ProposalNotFoundError
      || exception instanceof VoteNotFoundError
      || exception instanceof CapabilityNotFoundError) status = 404;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
