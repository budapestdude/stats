import { Request, Response, NextFunction } from 'express';

export const getAllGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Get all games - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const searchGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Search games - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const getGameById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Get game ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const createGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ message: 'Create game - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const importPGN = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Import PGN - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const importBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: 'Import batch - Not implemented yet' });
  } catch (error) {
    next(error);
  }
};

export const updateGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: `Update game ${req.params.id} - Not implemented yet` });
  } catch (error) {
    next(error);
  }
};

export const deleteGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};