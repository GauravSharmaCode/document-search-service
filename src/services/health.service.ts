import prisma from '../db/prisma';
import * as elasticsearchClient from '../db/elasticsearch';
import * as redisClient from '../db/redis';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  dependencies: {
    postgres: { status: string; latency_ms: number };
    elasticsearch: { status: string; latency_ms: number };
    redis: { status: string; latency_ms: number };
  };
  timestamp: string;
}

export const checkHealth = async (): Promise<HealthStatus> => {
  const checkPostgres = async () => {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latency: Date.now() - start };
    } catch (error) {
      return { status: 'down', latency: Date.now() - start };
    }
  };

  const [postgres, elasticsearch, redis] = await Promise.all([
    checkPostgres(),
    elasticsearchClient.healthCheck(),
    redisClient.healthCheck(),
  ]);

  const allUp = postgres.status === 'up' && elasticsearch.status === 'up' && redis.status === 'up';
  const anyDown = postgres.status === 'down' || elasticsearch.status === 'down' || redis.status === 'down';

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (allUp) {
    overallStatus = 'healthy';
  } else if (anyDown) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    dependencies: {
      postgres: { status: postgres.status, latency_ms: postgres.latency },
      elasticsearch: { status: elasticsearch.status, latency_ms: elasticsearch.latency },
      redis: { status: redis.status, latency_ms: redis.latency },
    },
    timestamp: new Date().toISOString(),
  };
};

export default {
  checkHealth,
};
