import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Last-resort shaped error responses. BC-scoped filters translate known
 * domain rejections first; anything reaching here is either an HTTP error
 * (status + message preserved) or an unexpected failure, answered as a
 * generic 500 without leaking internals.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        message: exception.message,
        statusCode: status,
      });
      return;
    }
    response.status(500).json({
      message: 'internal server error',
      statusCode: 500,
    });
  }
}
