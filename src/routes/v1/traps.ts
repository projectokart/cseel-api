import { Router } from 'express';
import { honeypotTrap } from '../../middleware/honeypot';

const router = Router();

// Any bot hitting these endpoints gets immediately auto-jailed
router.all('/dump-all', honeypotTrap);
router.all('/export-full-db', honeypotTrap);
router.all('/scrape', honeypotTrap);
router.all('/export', honeypotTrap);
router.all('/database-backup', honeypotTrap);

export default router;
