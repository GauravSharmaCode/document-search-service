import * as elasticsearchClient from '../db/elasticsearch';
import * as cacheService from './cache.service';
import config from '../config';
import { logger } from '../utils/logger';

export interface SearchResult {
  results: Array<{
    id: string;
    title: string;
    snippet: string;
    score: number;
  }>;
  total: number;
  limit: number;
  offset: number;
  took_ms: number;
}

export const search = async (
  tenantId: string,
  query: string,
  limit: number,
  offset: number
): Promise<SearchResult> => {
  const startTime = Date.now();

  // 1. Check cache
  const cacheKey = cacheService.generateSearchKey(tenantId, query, limit, offset);
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    logger.info('Search cache hit', {
      tenantId,
      query,
      limit,
      offset,
      correlationId: 'cache',
    });
    return {
      ...cached,
      took_ms: Date.now() - startTime,
    };
  }

  // 2. Query Elasticsearch
  logger.info('Search cache miss, querying Elasticsearch', {
    tenantId,
    query,
    limit,
    offset,
  });

  const searchResult = await elasticsearchClient.search(tenantId, query, limit, offset);

  const result: SearchResult = {
    results: searchResult.results,
    total: searchResult.total,
    limit,
    offset,
    took_ms: searchResult.took,
  };

  // 3. Cache the results
  await cacheService.set(cacheKey, result, config.cache.ttlSearch);

  logger.info('Search completed', {
    tenantId,
    query,
    total: result.total,
    took_ms: result.took_ms,
  });

  return result;
};

export default {
  search,
};
