import { Request, Response, NextFunction } from 'express';

export const getAllTournaments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Get all tournaments - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingTournaments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Get upcoming tournaments - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const getRecentTournaments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Get recent tournaments - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const getTournamentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Get tournament ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const getTournamentStandings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Get tournament standings ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const getTournamentGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Get tournament games ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const createTournament = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ message: 'Create tournament - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const updateTournament = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Update tournament ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const deleteTournament = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};