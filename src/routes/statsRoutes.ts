import { Router } from 'express';
import * as statsController from '../controllers/statsController';

const router = Router();

router.get('/overview', statsController.getOverviewStats);
router.get('/rating-distribution', statsController.getRatingDistribution);
router.get('/opening-trends', statsController.getOpeningTrends);
router.get('/game-lengths', statsController.getGameLengthStats);
router.get('/time-controls', statsController.getTimeControlStats);
router.get('/country-rankings', statsController.getCountryRankings);
router.get('/historical', statsController.getHistoricalStats);

export default router;