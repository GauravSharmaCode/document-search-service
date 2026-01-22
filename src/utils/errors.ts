export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(
    message: string,
    public retryAfter: number,
  ) {
    super(429, "RATE_LIMIT_EXCEEDED", message, { retry_after: retryAfter });
  }
}

export class InternalError extends AppError {
  constructor(message: string, details?: any) {
    super(500, "INTERNAL_ERROR", message, details);
  }
}

export class TenantError extends AppError {
  constructor(message: string, details?: any) {
    const errorMessage = message?.trim() || "Tenant validation failed";
    const errorDetails = {
      ...details,
      timestamp: new Date().toISOString(),
    };
    super(400, "TENANT_ERROR", errorMessage, errorDetails);
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const handleUnknownError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError("An unknown error occurred");
};
