import { Router } from 'express';
import * as gameController from '../controllers/gameController';

const router = Router();

router.get('/', gameController.getAllGames);
router.get('/search', gameController.searchGames);
router.get('/:id', gameController.getGameById);
router.post('/', gameController.createGame);
router.post('/import/pgn', gameController.importPGN);
router.post('/import/batch', gameController.importBatch);
router.put('/:id', gameController.updateGame);
router.delete('/:id', gameController.deleteGame);

export default router;