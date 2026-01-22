import { Router, Request, Response, NextFunction } from 'express';
import * as documentService from '../services/document.service';
import { CreateDocumentSchema, DocumentIdSchema } from '../schemas/document.schema';
import { logger } from '../utils/logger';

const router = Router();

// POST /v1/documents - Create document
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const data = CreateDocumentSchema.parse(req.body);

    logger.info('Creating document', {
      tenantId,
      correlationId: req.correlationId,
    });

    const result = await documentService.indexDocument(tenantId, data);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /v1/documents/:id - Get document by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const documentId = DocumentIdSchema.parse(req.params.id);

    logger.info('Retrieving document', {
      documentId,
      tenantId,
      correlationId: req.correlationId,
    });

    const document = await documentService.getDocument(tenantId, documentId);

    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/documents/:id - Delete document
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const documentId = DocumentIdSchema.parse(req.params.id);

    logger.info('Deleting document', {
      documentId,
      tenantId,
      correlationId: req.correlationId,
    });

    await documentService.deleteDocument(tenantId, documentId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
