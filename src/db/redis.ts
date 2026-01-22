import { createClient, RedisClientType } from 'redis';
import config from '../config';
import { logger } from '../utils/logger';

let client: RedisClientType | null = null;

export const initialize = async (): Promise<void> => {
  client = createClient({
    url: config.redis.url,
  });

  client.on('error', (err) => {
    logger.error('Redis client error', err);
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  await client.connect();
};

export const get = async (key: string): Promise<string | null> => {
  if (!client) throw new Error('Redis client not initialized');
  try {
    return await client.get(key);
  } catch (error) {
    logger.error('Redis GET error', error as Error, { key });
    return null;
  }
};

export const set = async (key: string, value: string, ttl?: number): Promise<void> => {
  if (!client) throw new Error('Redis client not initialized');
  try {
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  } catch (error) {
    logger.error('Redis SET error', error as Error, { key, ttl });
    throw error;
  }
};

export const del = async (key: string): Promise<void> => {
  if (!client) throw new Error('Redis client not initialized');
  try {
    await client.del(key);
  } catch (error) {
    logger.error('Redis DEL error', error as Error, { key });
    throw error;
  }
};

export const deletePattern = async (pattern: string): Promise<void> => {
  if (!client) throw new Error('Redis client not initialized');
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.debug('Deleted keys matching pattern', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Redis DELETE PATTERN error', error as Error, { pattern });
    throw error;
  }
};

export const increment = async (key: string, ttl?: number): Promise<number> => {
  if (!client) throw new Error('Redis client not initialized');
  try {
    const value = await client.incr(key);
    if (ttl && value === 1) {
      await client.expire(key, ttl);
    }
    return value;
  } catch (error) {
    logger.error('Redis INCR error', error as Error, { key });
    throw error;
  }
};

export const healthCheck = async (): Promise<{ status: string; latency: number }> => {
  const start = Date.now();
  if (!client) {
    return { status: 'down', latency: 0 };
  }
  try {
    await client.ping();
    const latency = Date.now() - start;
    return { status: 'up', latency };
  } catch (error) {
    logger.error('Redis health check failed', error as Error);
    return { status: 'down', latency: Date.now() - start };
  }
};

export const disconnect = async (): Promise<void> => {
  if (client) {
    try {
      await client.disconnect();
      client = null;
    } catch (error) {
      logger.error('Redis disconnect error', error as Error);
    }
  }
};

export const getClient = (): RedisClientType => {
  if (!client) throw new Error('Redis client not initialized');
  return client;
};

export default {
  initialize,
  get,
  set,
  del,
  deletePattern,
  increment,
  healthCheck,
  getClient,
};
