import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * Application error with a stable machine-readable `code` that the web client can branch on.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super({ message, code, details }, status);
  }

  static notFound(entity: string): AppException {
    return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${entity} not found`);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppException {
    return new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
  }

  static conflict(code: string, message: string, details?: ErrorDetail[]): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }

  static badRequest(code: string, message: string, details?: ErrorDetail[]): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static invalidReference(path: string, message: string): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, 'INVALID_REFERENCE', message, [{ path, message }]);
  }

  static planLimit(metric: string, limit: number | null): AppException {
    return new AppException(
      HttpStatus.PAYMENT_REQUIRED,
      'PLAN_LIMIT_REACHED',
      `Your plan allows ${limit ?? 'unlimited'} ${metric}. Upgrade your plan to add more.`,
    );
  }

  static planFeature(feature: string): AppException {
    return new AppException(
      HttpStatus.PAYMENT_REQUIRED,
      'PLAN_FEATURE_UNAVAILABLE',
      `The "${feature.replace(/_/g, ' ')}" feature is not included in your current plan.`,
    );
  }
}
