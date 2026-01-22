import * as documentRepository from '../repositories/document.repository';
import * as elasticsearchClient from '../db/elasticsearch';
import * as cacheService from './cache.service';
import config from '../config';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { CreateDocumentInput } from '../schemas/document.schema';

export const indexDocument = async (
  tenantId: string,
  data: CreateDocumentInput
): Promise<any> => {
  logger.info('Indexing document', { tenantId, title: data.title });

  // 1. Save to PostgreSQL (source of truth)
  const document = await documentRepository.create(tenantId, data);

  // 2. Index to Elasticsearch (async, best effort)
  try {
    await elasticsearchClient.indexDocument(
      document.id,
      tenantId,
      document.title,
      document.content
    );
  } catch (error) {
    logger.error('Failed to index document in Elasticsearch', error as Error, {
      documentId: document.id,
      tenantId,
    });
    // Don't fail the request if Elasticsearch indexing fails
  }

  logger.info('Document indexed successfully', {
    documentId: document.id,
    tenantId,
  });

  return {
    id: document.id,
    tenant_id: document.tenant_id,
    title: document.title,
    created_at: document.created_at,
  };
};

export const getDocument = async (
  tenantId: string,
  documentId: string
): Promise<any> => {
  // 1. Check cache
  const cacheKey = cacheService.generateDocumentKey(tenantId, documentId);
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    logger.debug('Document retrieved from cache', { documentId, tenantId });
    return cached;
  }

  // 2. Query PostgreSQL
  const document = await documentRepository.findById(tenantId, documentId);
  if (!document) {
    throw new NotFoundError('Document not found');
  }

  // 3. Cache the result
  const result = {
    id: document.id,
    tenant_id: document.tenant_id,
    title: document.title,
    content: document.content,
    metadata: document.metadata,
    created_at: document.created_at,
    updated_at: document.updated_at,
  };

  await cacheService.set(cacheKey, result, config.cache.ttlDocument);

  logger.debug('Document retrieved from database', { documentId, tenantId });
  return result;
};

export const deleteDocument = async (
  tenantId: string,
  documentId: string
): Promise<void> => {
  logger.info('Deleting document', { documentId, tenantId });

  // 1. Soft delete in PostgreSQL
  const deleted = await documentRepository.softDelete(tenantId, documentId);
  if (!deleted) {
    throw new NotFoundError('Document not found');
  }

  // 2. Remove from Elasticsearch
  try {
    await elasticsearchClient.deleteDocument(documentId);
  } catch (error) {
    logger.error('Failed to delete document from Elasticsearch', error as Error, {
      documentId,
      tenantId,
    });
  }

  // 3. Fire-and-forget cache eviction for document key (search cache relies on TTL)
  cacheService.evictDocumentCache(tenantId, documentId);

  logger.info('Document deleted successfully', { documentId, tenantId });
};

export default {
  indexDocument,
  getDocument,
  deleteDocument,
};
