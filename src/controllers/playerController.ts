import { Request, Response, NextFunction } from 'express';
import * as playerService from '../services/playerService';

export const getAllPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, sortBy = 'rating', order = 'desc' } = req.query;
    const players = await playerService.getAllPlayers({
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      order: order as 'asc' | 'desc'
    });
    res.json(players);
  } catch (error) {
    next(error);
  }
};

export const searchPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, country, title, minRating, maxRating } = req.query;
    const players = await playerService.searchPlayers({
      query: q as string,
      country: country as string,
      title: title as string,
      minRating: minRating ? Number(minRating) : undefined,
      maxRating: maxRating ? Number(maxRating) : undefined
    });
    res.json(players);
  } catch (error) {
    next(error);
  }
};

export const getTopPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category = 'classical', limit = 10 } = req.query;
    const players = await playerService.getTopPlayers(category as string, Number(limit));
    res.json(players);
  } catch (error) {
    next(error);
  }
};

export const getPlayerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await playerService.getPlayerById(req.params.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    return res.json(player);
  } catch (error) {
    next(error);
  }
};

export const getPlayerGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, opening, result, timeControl } = req.query;
    const games = await playerService.getPlayerGames(req.params.id, {
      page: Number(page),
      limit: Number(limit),
      opening: opening as string,
      result: result as string,
      timeControl: timeControl as string
    });
    res.json(games);
  } catch (error) {
    next(error);
  }
};

export const getPlayerStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await playerService.getPlayerStatistics(req.params.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getPlayerRatingHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category = 'all', period = '1y' } = req.query;
    const history = await playerService.getPlayerRatingHistory(
      req.params.id,
      category as string,
      period as string
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
};

export const getPlayerOpenings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { color = 'both' } = req.query;
    const openings = await playerService.getPlayerOpenings(req.params.id, color as string);
    res.json(openings);
  } catch (error) {
    next(error);
  }
};

export const createPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await playerService.createPlayer(req.body);
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
};

export const updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await playerService.updatePlayer(req.params.id, req.body);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    return res.json(player);
  } catch (error) {
    next(error);
  }
};

export const deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await playerService.deletePlayer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Player not found' });
    }
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};