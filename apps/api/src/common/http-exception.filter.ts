import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

/**
 * Maps an exception to the public error body. Known HttpExceptions keep their
 * status and message (validation errors stay explicit); anything else becomes
 * a generic 500 — internals and stack traces never reach the client.
 */
export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const resp = exception.getResponse();
    if (typeof resp === 'string') {
      return { statusCode: status, error: exception.name, message: resp };
    }
    const obj = resp as Record<string, unknown>;
    return {
      statusCode: status,
      error: typeof obj.error === 'string' ? obj.error : exception.name,
      message: (obj.message as string | string[]) ?? exception.message,
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    message: 'Internal server error',
  };
}

/** Global exception filter: consistent JSON error shape on every response. */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const body = toErrorBody(exception);

    if (body.statusCode >= 500) {
      const requestId = (req as any).requestId ?? 'unknown';
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`requestId=${requestId} ${req.method} ${req.url.split('?')[0]}`, stack);
    }

    res.status(body.statusCode).json(body);
  }
}
