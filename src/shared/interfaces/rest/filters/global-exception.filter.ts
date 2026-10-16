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
      // Preserve the structured detail: ValidationPipe carries the field-level
      // error array in getResponse(), which exception.message ("Bad Request")
      // would otherwise discard.
      const detail = exception.getResponse();
      const body = typeof detail === 'object' && detail !== null
        ? { ...(detail as Record<string, unknown>), statusCode: status }
        : { message: exception.message, statusCode: status };
      response.status(status).json(body);
      return;
    }
    response.status(500).json({
      message: 'internal server error',
      statusCode: 500,
    });
  }
}
