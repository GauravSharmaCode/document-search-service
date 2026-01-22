import { Request, Response, NextFunction } from 'express';
import { TenantError } from '../utils/errors';

export const csrfProtection = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Skip CSRF for GET requests (safe methods)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const tenantId = req.tenantId;

  if (!csrfToken) {
    throw new TenantError('CSRF token required');
  }

  // Simple token validation (in production, use proper CSRF library)
  if (!csrfToken.startsWith(`${tenantId}-`) || csrfToken.length < 20) {
    throw new TenantError('Invalid CSRF token');
  }

  next();
};