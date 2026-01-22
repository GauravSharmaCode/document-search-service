import * as cacheService from '../../services/cache.service';

describe('Cache Service', () => {
  describe('generateSearchKey', () => {
    it('should generate consistent cache keys', () => {
      const key1 = cacheService.generateSearchKey('tenant1', 'database', 10, 0);
      const key2 = cacheService.generateSearchKey('tenant1', 'database', 10, 0);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('search:tenant1:database:10:0');
    });

    it('should generate different keys for different parameters', () => {
      const key1 = cacheService.generateSearchKey('tenant1', 'database', 10, 0);
      const key2 = cacheService.generateSearchKey('tenant1', 'database', 20, 0);
      const key3 = cacheService.generateSearchKey('tenant2', 'database', 10, 0);
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('generateDocumentKey', () => {
    it('should generate consistent document cache keys', () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      const key1 = cacheService.generateDocumentKey('tenant1', docId);
      const key2 = cacheService.generateDocumentKey('tenant1', docId);
      
      expect(key1).toBe(key2);
      expect(key1).toBe(`document:tenant1:${docId}`);
    });

    it('should generate different keys for different tenants', () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      const key1 = cacheService.generateDocumentKey('tenant1', docId);
      const key2 = cacheService.generateDocumentKey('tenant2', docId);
      
      expect(key1).not.toBe(key2);
    });
  });
});
