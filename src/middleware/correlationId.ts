import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      tenantId?: string;
    }
  }
}

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const headerValue = req.headers['x-correlation-id'] as string;
  const correlationId = (headerValue && /^[a-zA-Z0-9-_]{1,128}$/.test(headerValue)) 
    ? headerValue 
    : uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};
