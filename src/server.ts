import express, { Application } from 'express';
import config from './config';
import { logger } from './utils/logger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { tenantIdMiddleware } from './middleware/tenantId';
import { rateLimiterMiddleware } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import documentRoutes from './routes/document.routes';
import searchRoutes from './routes/search.routes';
import healthRoutes from './routes/health.routes';
import * as redisClient from './db/redis';
import * as elasticsearchClient from './db/elasticsearch';
import prisma from './db/prisma';

const app: Application = express();

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(correlationIdMiddleware);

// Health check (no auth required)
app.use('/health', healthRoutes);

// Protected routes (require tenant ID and rate limiting)
app.use('/v1/documents', tenantIdMiddleware, rateLimiterMiddleware, documentRoutes);
app.use('/v1/search', tenantIdMiddleware, rateLimiterMiddleware, searchRoutes);

// Error handling
app.use(errorHandler);

// Initialize and start server
const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting document search service...');

    // Connect to Database (critical dependency)
    logger.info('Connecting to Database via Prisma...');
    await prisma.$connect();

    // Initialize Redis (best effort)
    logger.info('Connecting to Redis...');
    const redisReady = await redisClient.initialize();
    if (!redisReady) {
      logger.warn('Redis connection unavailable at startup. Proceeding without cache or rate limiting.');
    }

    // Initialize Elasticsearch index (best effort)
    logger.info('Initializing Elasticsearch index...');
    try {
      await elasticsearchClient.initializeIndex();
    } catch (error) {
      logger.warn('Elasticsearch initialization failed at startup. Search API will return 503 until available.', error as Error);
    }

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        nodeEnv: config.nodeEnv,
      });
    });

    server.on('error', (error: Error) => {
      logger.error('Server error', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  try {
    await prisma.$disconnect();
    await redisClient.disconnect();
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  try {
    await prisma.$disconnect();
    await redisClient.disconnect();
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();

export default app;
