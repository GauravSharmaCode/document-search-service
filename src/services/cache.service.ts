import redis from '../db/redis';
// import config from '../config';
import { logger } from '../utils/logger';

export const generateSearchKey = (
  tenantId: string,
  query: string,
  limit: number,
  offset: number
): string => {
  return `search:${tenantId}:${query}:${limit}:${offset}`;
};

export const generateDocumentKey = (tenantId: string, documentId: string): string => {
  return `document:${tenantId}:${documentId}`;
};

export const get = async (key: string): Promise<any | null> => {
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug('Cache hit', { key });
      return JSON.parse(cached);
    }
    logger.debug('Cache miss', { key });
    return null;
  } catch (error) {
    logger.error('Cache get error', error as Error, { key });
    return null;
  }
};

export const set = async (key: string, value: any, ttl: number): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(value), ttl);
    logger.debug('Cache set', { key, ttl });
  } catch (error) {
    logger.error('Cache set error', error as Error, { key });
  }
};

export const invalidate = async (pattern: string): Promise<void> => {
  try {
    await redis.deletePattern(pattern);
    logger.debug('Cache invalidated', { pattern });
  } catch (error) {
    logger.error('Cache invalidate error', error as Error, { pattern });
  }
};

export const invalidateDocument = async (tenantId: string, documentId: string): Promise<void> => {
  await invalidate(`document:${tenantId}:${documentId}`);
  await invalidate(`search:${tenantId}:*`);
};

export default {
  generateSearchKey,
  generateDocumentKey,
  get,
  set,
  invalidate,
  invalidateDocument,
};
