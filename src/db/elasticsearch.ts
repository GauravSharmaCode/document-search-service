import { Client } from '@elastic/elasticsearch';
import config from '../config';
import { logger } from '../utils/logger';

const client = new Client({
  node: config.elasticsearch.node,
  requestTimeout: 30000,
  maxRetries: 3,
});

const INDEX_NAME = 'documents';

export const initializeIndex = async (): Promise<void> => {
  try {
    const indexExists = await client.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          settings: {
            index: {
              max_result_window: 10000,
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
          mappings: {
            properties: {
              document_id: { type: 'keyword' },
              tenant_id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'standard',
              },
              content: {
                type: 'text',
                analyzer: 'standard',
              },
              indexed_at: { type: 'date' },
            },
          },
        },
      });
      logger.info('Elasticsearch index created', { index: INDEX_NAME });
    } else {
      logger.info('Elasticsearch index already exists', { index: INDEX_NAME });
    }
  } catch (error) {
    logger.error('Failed to initialize Elasticsearch index', error as Error);
    throw error;
  }
};

export const indexDocument = async (
  documentId: string,
  tenantId: string,
  title: string,
  content: string
): Promise<void> => {
  try {
    await client.index({
      index: INDEX_NAME,
      id: documentId,
      document: {
        document_id: documentId,
        tenant_id: tenantId,
        title,
        content,
        indexed_at: new Date().toISOString(),
      },
      refresh: 'wait_for',
    });
    logger.debug('Document indexed in Elasticsearch', { documentId, tenantId });
  } catch (error) {
    logger.error('Failed to index document in Elasticsearch', error as Error, {
      documentId,
      tenantId,
    });
    throw error;
  }
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  try {
    await client.delete({
      index: INDEX_NAME,
      id: documentId,
      refresh: 'wait_for',
    });
    logger.debug('Document deleted from Elasticsearch', { documentId });
  } catch (error: any) {
    if (error.meta?.statusCode === 404) {
      logger.warn('Document not found in Elasticsearch for deletion', { documentId });
    } else {
      logger.error('Failed to delete document from Elasticsearch', error, { documentId });
      throw error;
    }
  }
};

export const search = async (
  tenantId: string,
  query: string,
  limit: number,
  offset: number
): Promise<{ results: any[]; total: number; took: number }> => {
  try {
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['title^2', 'content'],
                  fuzziness: 'AUTO',
                  prefix_length: 2,
                },
              },
            ],
            filter: [
              {
                term: { tenant_id: tenantId },
              },
            ],
          },
        },
        from: offset,
        size: limit,
        highlight: {
          fields: {
            title: {},
            content: {
              fragment_size: 150,
              number_of_fragments: 1,
            },
          },
          pre_tags: ['<em>'],
          post_tags: ['</em>'],
        },
      },
    });

    const results = response.hits.hits.map((hit: any) => ({
      id: hit._source.document_id,
      title: hit._source.title,
      snippet: hit.highlight?.content?.[0] || hit._source.content.substring(0, 150) + '...',
      score: hit._score,
    }));

    return {
      results,
      total: typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0,
      took: response.took,
    };
  } catch (error) {
    logger.error('Elasticsearch search failed', error as Error, { tenantId, query });
    throw error;
  }
};

export const healthCheck = async (): Promise<{ status: string; latency: number }> => {
  const start = Date.now();
  try {
    await client.cluster.health();
    const latency = Date.now() - start;
    return { status: 'up', latency };
  } catch (error) {
    logger.error('Elasticsearch health check failed', error as Error);
    return { status: 'down', latency: Date.now() - start };
  }
};

export default client;
