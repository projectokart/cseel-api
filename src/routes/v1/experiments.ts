import { Router } from 'express';
import { ExperimentsController } from '../../controllers/experimentsController';

const router = Router();

// Listing & Search with pagination & summary
router.get('/', ExperimentsController.list);

// Single Experiment by slug or id
router.get('/:slug', ExperimentsController.getBySlug);

// Management routes
router.post('/', ExperimentsController.create);
router.put('/:id', ExperimentsController.update);
router.delete('/:id', ExperimentsController.remove);

export default router;
