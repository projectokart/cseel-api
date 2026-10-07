import { Router } from 'express';
import experimentsRouter from './experiments';
import trapsRouter from './traps';
import healthRouter from '../health';

const router = Router();

// Health under /v1/health
router.use('/health', healthRouter);

// Experiments under /v1/experiments
router.use('/experiments', experimentsRouter);

// Traps under /v1/traps
router.use('/traps', trapsRouter);
router.use('/', trapsRouter); // traps at root of /v1

export default router;
