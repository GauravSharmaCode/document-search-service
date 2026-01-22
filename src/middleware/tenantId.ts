import { Request, Response, NextFunction } from 'express';
import { TenantError } from '../utils/errors';

export const tenantIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void res;
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    throw new TenantError('X-Tenant-ID header is required');
  }

  req.tenantId = tenantId;
  next();
};
