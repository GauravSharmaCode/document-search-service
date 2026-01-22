import { Request, Response, NextFunction } from 'express';
import { correlationIdMiddleware } from '../../middleware/correlationId';
import { tenantIdMiddleware } from '../../middleware/tenantId';
import { csrfProtection } from '../../middleware/csrfProtection';

describe('Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = { setHeader: jest.fn() };
    mockNext = jest.fn();
  });

  describe('correlationIdMiddleware', () => {
    it('should generate correlation ID when not provided', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.correlationId).toBeDefined();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Correlation-ID', mockReq.correlationId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use provided correlation ID when valid', () => {
      mockReq.headers = { 'x-correlation-id': 'test-123' };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.correlationId).toBe('test-123');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'test-123');
    });

    it('should reject invalid correlation ID with special characters', () => {
      mockReq.headers = { 'x-correlation-id': 'test\r\nmalicious' };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.correlationId).not.toBe('test\r\nmalicious');
      expect(mockReq.correlationId).toMatch(/^[a-zA-Z0-9-_]+$/);
    });
  });

  describe('tenantIdMiddleware', () => {
    it('should extract tenant ID from header', () => {
      mockReq.headers = { 'x-tenant-id': 'tenant_123' };
      
      tenantIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.tenantId).toBe('tenant_123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error when tenant ID is missing', () => {
      expect(() => {
        tenantIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });
  });

  describe('csrfProtection', () => {
    beforeEach(() => {
      mockReq.tenantId = 'tenant_123';
    });

    it('should skip CSRF for GET requests', () => {
      mockReq.method = 'GET';
      
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should require CSRF token for POST requests', () => {
      mockReq.method = 'POST';
      
      expect(() => {
        csrfProtection(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should validate CSRF token format', () => {
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': 'tenant_123-valid-token-12345' };
      
      csrfProtection(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});