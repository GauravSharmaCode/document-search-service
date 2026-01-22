import { CreateDocumentSchema, SearchQuerySchema, DocumentIdSchema } from '../../schemas/document.schema';

describe('Document Schema Validation', () => {
  describe('CreateDocumentSchema', () => {
    it('should validate a valid document', () => {
      const validDocument = {
        title: 'Test Document',
        content: 'This is test content',
        metadata: { category: 'test' },
      };

      const result = CreateDocumentSchema.safeParse(validDocument);
      expect(result.success).toBe(true);
    });

    it('should reject document with missing title', () => {
      const invalidDocument = {
        content: 'This is test content',
      };

      const result = CreateDocumentSchema.safeParse(invalidDocument);
      expect(result.success).toBe(false);
    });

    it('should reject document with title exceeding 500 characters', () => {
      const invalidDocument = {
        title: 'a'.repeat(501),
        content: 'This is test content',
      };

      const result = CreateDocumentSchema.safeParse(invalidDocument);
      expect(result.success).toBe(false);
    });

    it('should reject document with content exceeding 1MB', () => {
      const invalidDocument = {
        title: 'Test',
        content: 'a'.repeat(1048577),
      };

      const result = CreateDocumentSchema.safeParse(invalidDocument);
      expect(result.success).toBe(false);
    });

    it('should accept document without metadata', () => {
      const validDocument = {
        title: 'Test Document',
        content: 'This is test content',
      };

      const result = CreateDocumentSchema.safeParse(validDocument);
      expect(result.success).toBe(true);
    });
  });

  describe('SearchQuerySchema', () => {
    it('should validate a valid search query', () => {
      const validQuery = {
        q: 'database',
        limit: '10',
        offset: '0',
      };

      const result = SearchQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should use default values for limit and offset', () => {
      const queryWithoutPagination = {
        q: 'database',
      };

      const result = SearchQuerySchema.safeParse(queryWithoutPagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject query with limit > 100', () => {
      const invalidQuery = {
        q: 'database',
        limit: '101',
      };

      const result = SearchQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should reject query without q parameter', () => {
      const invalidQuery = {
        limit: '10',
      };

      const result = SearchQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe('DocumentIdSchema', () => {
    it('should validate a valid UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = DocumentIdSchema.safeParse(validUuid);
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const invalidUuid = 'not-a-uuid';
      const result = DocumentIdSchema.safeParse(invalidUuid);
      expect(result.success).toBe(false);
    });
  });
});
