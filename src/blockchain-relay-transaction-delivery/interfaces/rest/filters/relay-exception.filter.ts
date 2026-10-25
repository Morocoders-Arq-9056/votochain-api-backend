import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { IllegalDeliveryStateError } from '../../../domain/exceptions/illegal-delivery-state.error.js';
import { OrderAlreadyAcceptedError } from '../../../domain/exceptions/order-already-accepted.error.js';
import { OrderConcludedError } from '../../../domain/exceptions/order-concluded.error.js';
import { OrderNotFoundError } from '../../../domain/exceptions/order-not-found.error.js';
import { OvertakingRefusedError } from '../../../domain/exceptions/overtaking-refused.error.js';
import { UnsignedContentRefusedError } from '../../../domain/exceptions/unsigned-content-refused.error.js';

/**
 * Maps Relay domain rejections to HTTP statuses. Unknown ids â†’ 404;
 * unsigned intake â†’ 422; accept races/overtaking/terminal/illegal â†’ 409.
 */
@Catch(
  OrderNotFoundError,
  UnsignedContentRefusedError,
  OrderAlreadyAcceptedError,
  OvertakingRefusedError,
  OrderConcludedError,
  IllegalDeliveryStateError,
)
export class RelayExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 409;
    if (exception instanceof OrderNotFoundError) status = 404;
    else if (exception instanceof UnsignedContentRefusedError) status = 422;
    response.status(status).json({ message: exception.message, statusCode: status });
  }
}
