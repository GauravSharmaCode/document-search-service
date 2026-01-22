import {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitExceededError,
  InternalError,
  TenantError,
  isAppError,
  handleUnknownError,
} from '../../utils/errors';

describe('Error Utilities Tests', () => {
  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError(400, 'TEST_ERROR', 'Test message', { field: 'test' });

      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.name).toBe('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'title' });

      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'title' });
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with 404 status', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('RateLimitExceededError', () => {
    it('should create RateLimitExceededError with retry after', () => {
      const error = new RateLimitExceededError('Rate limit exceeded', 60);

      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
      expect(error.details).toEqual({ retry_after: 60 });
    });
  });

  describe('TenantError', () => {
    it('should create TenantError with proper message validation', () => {
      const error = new TenantError('Invalid tenant');

      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('TENANT_ERROR');
      expect(error.message).toBe('Invalid tenant');
      expect(error.details.timestamp).toBeDefined();
    });

    it('should handle empty message with fallback', () => {
      const error = new TenantError('');

      expect(error.message).toBe('Tenant validation failed');
    });

    it('should handle undefined message with fallback', () => {
      const error = new TenantError(undefined as any);

      expect(error.message).toBe('Tenant validation failed');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new ValidationError('Test');
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('handleUnknownError', () => {
    it('should return AppError as-is', () => {
      const originalError = new ValidationError('Test');
      const result = handleUnknownError(originalError);

      expect(result).toBe(originalError);
    });

    it('should convert Error to InternalError', () => {
      const originalError = new Error('Test error');
      const result = handleUnknownError(originalError);

      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toBe('Test error');
    });

    it('should handle unknown objects', () => {
      const result = handleUnknownError('string error');

      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toBe('An unknown error occurred');
    });
  });
});