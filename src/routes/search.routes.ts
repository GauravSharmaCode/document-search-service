import { Router, Request, Response, NextFunction } from 'express';
import * as searchService from '../services/search.service';
import { SearchQuerySchema } from '../schemas/document.schema';
import { logger } from '../utils/logger';

const router = Router();

// GET /v1/search - Search documents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { q, limit, offset } = SearchQuerySchema.parse(req.query);

    logger.info('Searching documents', {
      tenantId,
      query: q,
      limit,
      offset,
      correlationId: req.correlationId,
    });

    const results = await searchService.search(tenantId, q, limit, offset);

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
