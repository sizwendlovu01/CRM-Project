import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@crm/shared';
import { ZodError } from 'zod';
import { zodErrorDetails } from './zod';

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/**
 * Centralised error handling. Produces a consistent JSON shape and never leaks stack traces
 * or internal error messages to clients. Unexpected errors are logged with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const body = this.toBody(exception);
    body.requestId = typeof request.id === 'string' ? request.id : undefined;

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: body.requestId, path: request.url, method: request.method },
        'Unhandled error',
      );
    }

    if (!response.headersSent) response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ThrottlerException) {
      return this.build(429, 'Too many requests. Please slow down and try again shortly.', 'RATE_LIMITED');
    }

    if (exception instanceof ZodError) {
      return this.build(400, 'Validation failed', 'VALIDATION_FAILED', zodErrorDetails(exception));
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') return this.build(status, res);
      const payload = res as { message?: string | string[]; code?: string; details?: ApiErrorBody['details'] };
      const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message ?? exception.message;
      return this.build(status, message, payload.code, payload.details);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return this.build(409, 'A record with these details already exists.', 'DUPLICATE');
        case 'P2025':
          return this.build(404, 'The requested record was not found.', 'NOT_FOUND');
        case 'P2003':
          return this.build(400, 'A referenced record does not exist.', 'INVALID_REFERENCE');
        default:
          return this.build(500, 'An unexpected database error occurred.', 'DATABASE_ERROR');
      }
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return this.build(503, 'The service is temporarily unavailable. Please try again.', 'SERVICE_UNAVAILABLE');
    }

    if (isPayloadTooLarge(exception)) {
      return this.build(413, 'The request payload is too large.', 'PAYLOAD_TOO_LARGE');
    }

    return this.build(HttpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong on our side. Please try again.', 'INTERNAL_ERROR');
  }

  private build(statusCode: number, message: string, code?: string, details?: ApiErrorBody['details']): ApiErrorBody {
    return {
      statusCode,
      error: STATUS_NAMES[statusCode] ?? 'Error',
      message,
      code: code ?? defaultCode(statusCode),
      ...(details && details.length ? { details } : {}),
    };
  }
}

function defaultCode(status: number): string {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'BAD_REQUEST';
}

function isPayloadTooLarge(exception: unknown): boolean {
  return typeof exception === 'object' && exception !== null && (exception as { type?: string }).type === 'entity.too.large';
}
