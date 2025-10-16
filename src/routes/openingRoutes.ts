import { Router } from 'express';
import * as openingController from '../controllers/openingController';

const router = Router();

router.get('/', openingController.getAllOpenings);
router.get('/explorer', openingController.openingExplorer);
router.get('/popular', openingController.getPopularOpenings);
router.get('/eco/:eco', openingController.getOpeningByECO);
router.get('/:id', openingController.getOpeningById);
router.get('/:id/statistics', openingController.getOpeningStatistics);
router.post('/', openingController.createOpening);
router.put('/:id', openingController.updateOpening);
router.delete('/:id', openingController.deleteOpening);

export default router;