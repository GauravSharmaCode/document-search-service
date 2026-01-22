import request from 'supertest';
import express from 'express';
import documentRoutes from '../../routes/document.routes';
import searchRoutes from '../../routes/search.routes';
import healthRoutes from '../../routes/health.routes';
import { correlationIdMiddleware } from '../../middleware/correlationId';
import { tenantIdMiddleware } from '../../middleware/tenantId';
import { errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../services/document.service');
jest.mock('../../services/search.service');
jest.mock('../../services/health.service');
jest.mock('../../middleware/rateLimiter', () => ({
  rateLimiterMiddleware: (_req: any, _res: any, next: any) => next(),
}));

describe('Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    
    // Health routes (no auth)
    app.use('/health', healthRoutes);
    
    // Protected routes
    app.use('/v1/documents', tenantIdMiddleware, documentRoutes);
    app.use('/v1/search', tenantIdMiddleware, searchRoutes);
    
    app.use(errorHandler);
  });

  describe('Health Routes', () => {
    it('should return health status', async () => {
      const healthService = require('../../services/health.service');
      healthService.checkHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        dependencies: {
          postgres: { status: 'up', latency_ms: 2 },
          elasticsearch: { status: 'up', latency_ms: 15 },
          redis: { status: 'up', latency_ms: 1 },
        },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Document Routes', () => {
    it('should create document with valid tenant', async () => {
      const documentService = require('../../services/document.service');
      documentService.indexDocument = jest.fn().mockResolvedValue({
        id: 'doc_123',
        tenant_id: 'tenant_123',
        title: 'Test Doc',
        created_at: new Date(),
      });

      const response = await request(app)
        .post('/v1/documents')
        .set('X-Tenant-ID', 'tenant_123')
        .set('X-CSRF-Token', 'tenant_123-valid-token-12345')
        .send({
          title: 'Test Document',
          content: 'Test content',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('doc_123');
    });

    it('should reject request without tenant ID', async () => {
      const response = await request(app)
        .post('/v1/documents')
        .send({
          title: 'Test Document',
          content: 'Test content',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Search Routes', () => {
    it('should search documents', async () => {
      const searchService = require('../../services/search.service');
      searchService.search = jest.fn().mockResolvedValue({
        results: [
          {
            id: 'doc_123',
            title: 'Test Doc',
            snippet: 'Test content',
            score: 1.0,
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
        took_ms: 50,
      });

      const response = await request(app)
        .get('/v1/search?q=test&limit=10&offset=0')
        .set('X-Tenant-ID', 'tenant_123');

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });
  });
});