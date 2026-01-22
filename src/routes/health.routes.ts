import { Router, Request, Response, NextFunction } from 'express';
import * as healthService from '../services/health.service';

const router = Router();

// GET /health - Health check
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    void req;
    const health = await healthService.checkHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
});

export default router;
