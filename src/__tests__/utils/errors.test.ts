import { AppError, ValidationError, NotFoundError, RateLimitError } from '../../utils/errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with correct properties', () => {
      const error = new ValidationError('Invalid input', { field: 'title' });
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'title' });
    });
  });

  describe('NotFoundError', () => {
    it('should create error with correct properties', () => {
      const error = new NotFoundError('Document not found');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.message).toBe('Document not found');
    });
  });

  describe('RateLimitError', () => {
    it('should create error with retry_after', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
      expect(error.details).toEqual({ retry_after: 60 });
    });
  });
});
