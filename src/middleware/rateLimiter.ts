import { Request, Response, NextFunction } from 'express';
import redis from '../db/redis';
import config from '../config';
import { RateLimitExceededError } from '../utils/errors';
import { logger } from '../utils/logger';

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return next();
    }

    const key = `rate_limit:${tenantId}`;
    const windowSeconds = Math.floor(config.rateLimit.windowMs / 1000);

    const count = await redis.increment(key, windowSeconds);

    res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimit.maxRequests - count).toString());

    if (count > config.rateLimit.maxRequests) {
      logger.warn('Rate limit exceeded', {
        tenantId,
        count,
        limit: config.rateLimit.maxRequests,
        correlationId: req.correlationId,
      });
      throw new RateLimitExceededError(
        'Tenant has exceeded rate limit',
        windowSeconds
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
