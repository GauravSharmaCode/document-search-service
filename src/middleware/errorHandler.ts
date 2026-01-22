import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void next;
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof AppError) {
    logger.warn('Application error', {
      errorCode: err.errorCode,
      message: err.message,
      statusCode: err.statusCode,
      correlationId,
      tenantId: req.tenantId,
    });

    res.status(err.statusCode).json({
      error_code: err.errorCode,
      message: err.message,
      details: err.details,
      trace_id: correlationId,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn('Validation error', {
      errors: err.errors,
      correlationId,
      tenantId: req.tenantId,
    });

    res.status(400).json({
      error_code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors,
      trace_id: correlationId,
    });
    return;
  }

  logger.error('Unhandled error', err, {
    correlationId,
    tenantId: req.tenantId,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error_code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    trace_id: correlationId,
  });
};
