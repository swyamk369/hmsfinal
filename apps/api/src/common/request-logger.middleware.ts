import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestLogFields {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: string | null;
  tenantId: string | null;
}

/**
 * Builds the structured log line for one request. Deliberately excludes the
 * query string, headers, and body — they can carry tokens, PHI, and search
 * terms (patient names/phones). Only the route path is logged.
 */
export function formatRequestLog(fields: RequestLogFields): string {
  return JSON.stringify(fields);
}

/** Strips the query string so sensitive query params never reach the logs. */
export function pathOnly(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/**
 * Structured request logging. Runs as middleware (before guards) so denied
 * requests are logged too. Assigns a requestId, exposed on the response as
 * X-Request-Id and on req for the exception filter to correlate 500s.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const startedAt = Date.now();

    res.on('finish', () => {
      const ctx = (req as any).ctx ?? {};
      this.logger.log(
        formatRequestLog({
          requestId,
          method: req.method,
          path: pathOnly(req.originalUrl ?? req.url),
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
          userId: ctx.userId ?? null,
          tenantId: ctx.tenantId ?? null,
        }),
      );
    });

    next();
  }
}
