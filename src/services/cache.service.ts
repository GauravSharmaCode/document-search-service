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

export const evictDocumentCache = (tenantId: string, documentId: string): void => {
  const key = generateDocumentKey(tenantId, documentId);

  void redis
    .del(key)
    .then(() => {
      logger.debug('Document cache evicted', { key });
    })
    .catch((error: Error) => {
      logger.error('Document cache eviction error', error, { key });
    });
};

export default {
  generateSearchKey,
  generateDocumentKey,
  get,
  set,
  evictDocumentCache,
};
