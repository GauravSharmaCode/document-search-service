import * as documentService from '../../services/document.service';
import * as searchService from '../../services/search.service';
import * as cacheService from '../../services/cache.service';

// Mock dependencies
jest.mock('../../repositories/document.repository');
jest.mock('../../db/elasticsearch');
jest.mock('../../db/redis');

describe('Service Tests', () => {
  describe('cacheService', () => {
    it('should generate search cache key correctly', () => {
      const key = cacheService.generateSearchKey('tenant_123', 'test query', 10, 0);
      expect(key).toBe('search:tenant_123:test query:10:0');
    });

    it('should generate document cache key correctly', () => {
      const key = cacheService.generateDocumentKey('tenant_123', 'doc_456');
      expect(key).toBe('document:tenant_123:doc_456');
    });
  });

  describe('searchService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return cached results when available', async () => {
      const mockCached = {
        results: [{ id: '1', title: 'Test', snippet: 'test', score: 1.0 }],
        total: 1,
        limit: 10,
        offset: 0,
        took_ms: 50
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(mockCached);

      const result = await searchService.search('tenant_123', 'test', 10, 0);

      expect(result.results).toEqual(mockCached.results);
      expect(result.total).toBe(1);
    });

    it('should query Elasticsearch when cache miss', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();

      const mockSearchResult = {
        results: [{ id: '1', title: 'Test', snippet: 'test', score: 1.0 }],
        total: 1,
        took: 100
      };

      const elasticsearchClient = require('../../db/elasticsearch');
      elasticsearchClient.search = jest.fn().mockResolvedValue(mockSearchResult);

      const result = await searchService.search('tenant_123', 'test', 10, 0);

      expect(elasticsearchClient.search).toHaveBeenCalledWith('tenant_123', 'test', 10, 0);
      expect(result.total).toBe(1);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('documentService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create document and index to Elasticsearch', async () => {
      const mockDocument = {
        id: 'doc_123',
        tenant_id: 'tenant_123',
        title: 'Test Doc',
        content: 'Test content',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        metadata: null
      };

      const documentRepository = require('../../repositories/document.repository');
      documentRepository.create = jest.fn().mockResolvedValue(mockDocument);

      const elasticsearchClient = require('../../db/elasticsearch');
      elasticsearchClient.indexDocument = jest.fn().mockResolvedValue(true);

      jest.spyOn(cacheService, 'invalidate').mockResolvedValue(undefined);

      const result = await documentService.indexDocument('tenant_123', {
        title: 'Test Doc',
        content: 'Test content'
      });

      expect(documentRepository.create).toHaveBeenCalled();
      expect(elasticsearchClient.indexDocument).toHaveBeenCalled();
      expect(result.id).toBe('doc_123');
    });

    it('should get document from cache or repository', async () => {
      const mockDocument = {
        id: 'doc_123',
        tenant_id: 'tenant_123',
        title: 'Test Doc',
        content: 'Test content',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        metadata: null
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();

      const documentRepository = require('../../repositories/document.repository');
      documentRepository.findById = jest.fn().mockResolvedValue(mockDocument);

      const result = await documentService.getDocument('tenant_123', 'doc_123');

      expect(documentRepository.findById).toHaveBeenCalledWith('tenant_123', 'doc_123');
      expect(result.id).toBe('doc_123');
    });

    it('should throw NotFoundError when document not found', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);

      const documentRepository = require('../../repositories/document.repository');
      documentRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        documentService.getDocument('tenant_123', 'nonexistent')
      ).rejects.toThrow('Document not found');
    });
  });
});