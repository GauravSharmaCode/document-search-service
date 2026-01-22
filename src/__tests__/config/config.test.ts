import config from '../../config';

describe('Configuration Tests', () => {
  it('should have default values', () => {
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test'); // Jest sets NODE_ENV to 'test'
    expect(config.cache.ttlSearch).toBe(300);
    expect(config.cache.ttlDocument).toBe(600);
    expect(config.rateLimit.maxRequests).toBe(100);
  });

  it('should have database configuration', () => {
    expect(config.database.url).toContain('postgresql://');
    expect(config.database.host).toBeDefined();
    expect(config.database.port).toBe(5432);
  });

  it('should have elasticsearch configuration', () => {
    expect(config.elasticsearch.node).toContain('http://');
  });

  it('should have redis configuration', () => {
    expect(config.redis.url).toContain('redis://');
    expect(config.redis.port).toBe(6379);
  });
});