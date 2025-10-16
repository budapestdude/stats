import { Router } from 'express';
import * as playerController from '../controllers/playerController';

const router = Router();

router.get('/', playerController.getAllPlayers);
router.get('/search', playerController.searchPlayers);
router.get('/top', playerController.getTopPlayers);
router.get('/:id', playerController.getPlayerById);
router.get('/:id/games', playerController.getPlayerGames);
router.get('/:id/statistics', playerController.getPlayerStatistics);
router.get('/:id/rating-history', playerController.getPlayerRatingHistory);
router.get('/:id/openings', playerController.getPlayerOpenings);
router.post('/', playerController.createPlayer);
router.put('/:id', playerController.updatePlayer);
router.delete('/:id', playerController.deletePlayer);

export default router;