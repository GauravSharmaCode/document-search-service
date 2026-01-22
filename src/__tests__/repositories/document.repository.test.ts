import * as documentRepository from '../../repositories/document.repository';

// Mock Prisma with inline functions
jest.mock('../../db/prisma', () => ({
  document: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

// Get the mocked prisma
const mockPrisma = require('../../db/prisma');

describe('Document Repository Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create document with correct data', async () => {
      const mockDocument = {
        id: 'doc_123',
        tenant_id: 'tenant_123',
        title: 'Test Doc',
        content: 'Test content',
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await documentRepository.create('tenant_123', {
        title: 'Test Doc',
        content: 'Test content',
      });

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 'tenant_123',
          title: 'Test Doc',
          content: 'Test content',
          metadata: expect.any(Object),
        },
      });
      expect(result).toEqual(mockDocument);
    });
  });

  describe('findById', () => {
    it('should find document by id and tenant', async () => {
      const mockDocument = {
        id: 'doc_123',
        tenant_id: 'tenant_123',
        title: 'Test Doc',
        content: 'Test content',
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await documentRepository.findById('tenant_123', 'doc_123');

      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'doc_123',
          tenant_id: 'tenant_123',
          deleted_at: null,
        },
      });
      expect(result).toEqual(mockDocument);
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await documentRepository.findById('tenant_123', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});