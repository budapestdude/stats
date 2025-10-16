import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';

const router = Router();

router.get('/', tournamentController.getAllTournaments);
router.get('/upcoming', tournamentController.getUpcomingTournaments);
router.get('/recent', tournamentController.getRecentTournaments);
router.get('/:id', tournamentController.getTournamentById);
router.get('/:id/standings', tournamentController.getTournamentStandings);
router.get('/:id/games', tournamentController.getTournamentGames);
router.post('/', tournamentController.createTournament);
router.put('/:id', tournamentController.updateTournament);
router.delete('/:id', tournamentController.deleteTournament);

export default router;