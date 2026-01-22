export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, public retryAfter: number) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, { retry_after: retryAfter });
  }
}

export class InternalError extends AppError {
  constructor(message: string, details?: any) {
    super(500, 'INTERNAL_ERROR', message, details);
  }
}

export class TenantError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'TENANT_ERROR', message, details);
  }
}
