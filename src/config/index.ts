import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  elasticsearch: {
    node: string;
  };
  redis: {
    url: string;
    host: string;
    port: number;
  };
  cache: {
    ttlSearch: number;
    ttlDocument: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
  };
}

const parseIntSafe = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const config: Config = {
  port: parseIntSafe(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/document_search',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseIntSafe(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || 'document_search',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseIntSafe(process.env.REDIS_PORT, 6379),
  },
  cache: {
    ttlSearch: parseIntSafe(process.env.CACHE_TTL_SEARCH, 300),
    ttlDocument: parseIntSafe(process.env.CACHE_TTL_DOCUMENT, 600),
  },
  rateLimit: {
    windowMs: parseIntSafe(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    maxRequests: parseIntSafe(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
