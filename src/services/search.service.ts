import * as elasticsearchClient from '../db/elasticsearch';
import * as cacheService from './cache.service';
import config from '../config';
import { logger } from '../utils/logger';
import { ServiceUnavailableError } from '../utils/errors';

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
    cached.took_ms = Date.now() - startTime;
    return cached;
  }

  // 2. Query Elasticsearch
  logger.info('Search cache miss, querying Elasticsearch', {
    tenantId,
    query,
    limit,
    offset,
  });

  let searchResult: { results: any[]; total: number; took: number };
  try {
    searchResult = await elasticsearchClient.search(tenantId, query, limit, offset);
  } catch (error) {
    logger.error('Search service unavailable', error as Error, {
      tenantId,
      query,
      limit,
      offset,
    });
    throw new ServiceUnavailableError('Search service temporarily unavailable');
  }

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
