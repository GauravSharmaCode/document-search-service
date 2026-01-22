import { createClient } from 'redis';
import config from '../config';
import { logger } from '../utils/logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export const initialize = async (): Promise<boolean> => {
  const instance = createClient({
    url: config.redis.url,
  });

  instance.on('error', (err) => {
    logger.error('Redis client error', err);
  });

  instance.on('connect', () => {
    logger.info('Redis client connected');
  });

  try {
    await instance.connect();
    client = instance;
    return true;
  } catch (error) {
    logger.warn('Redis unavailable, continuing without cache', error as Error);
    try {
      await instance.disconnect();
    } catch (disconnectError) {
      logger.debug('Ignored Redis disconnect error after failed init', disconnectError as Error);
    }
    client = null;
    return false;
  }
};

export const get = async (key: string): Promise<string | null> => {
  if (!client) {
    logger.debug('Redis unavailable, cache get skipped', { key });
    return null;
  }
  try {
    return await client.get(key);
  } catch (error) {
    logger.error('Redis GET error', error as Error, { key });
    return null;
  }
};

export const set = async (key: string, value: string, ttl?: number): Promise<void> => {
  if (!client) {
    logger.debug('Redis unavailable, cache set skipped', { key });
    return;
  }
  try {
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  } catch (error) {
    logger.error('Redis SET error', error as Error, { key, ttl });
  }
};

export const del = async (key: string): Promise<void> => {
  if (!client) {
    logger.debug('Redis unavailable, cache delete skipped', { key });
    return;
  }
  try {
    await client.del(key);
  } catch (error) {
    logger.error('Redis DEL error', error as Error, { key });
  }
};

export const deletePattern = async (pattern: string): Promise<void> => {
  if (!client) {
    logger.debug('Redis unavailable, cache pattern delete skipped', { pattern });
    return;
  }
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.debug('Deleted keys matching pattern', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Redis DELETE PATTERN error', error as Error, { pattern });
  }
};

export const increment = async (key: string, ttl?: number): Promise<number> => {
  if (!client) {
    logger.debug('Redis unavailable, rate limiting skipped', { key });
    return 1;
  }
  try {
    const value = await client.incr(key);
    if (ttl && value === 1) {
      await client.expire(key, ttl);
    }
    return value;
  } catch (error) {
    logger.error('Redis INCR error', error as Error, { key });
    return 1;
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
    } catch (error) {
      logger.error('Redis disconnect error', error as Error);
    } finally {
      client = null;
    }
  }
};

export const getClient = (): RedisClient | null => {
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
  disconnect,
};
