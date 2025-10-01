import { query } from '../config/database';
import { getCached, setCached, deleteCached } from '../config/redis';

interface PlayerFilters {
  page: number;
  limit: number;
  sortBy: string;
  order: 'asc' | 'desc';
}

interface SearchFilters {
  query?: string;
  country?: string;
  title?: string;
  minRating?: number;
  maxRating?: number;
}

interface GameFilters {
  page: number;
  limit: number;
  opening?: string;
  result?: string;
  timeControl?: string;
}

export async function getAllPlayers(filters: PlayerFilters) {
  const offset = (filters.page - 1) * filters.limit;
  
  const cacheKey = `players:${filters.page}:${filters.limit}:${filters.sortBy}:${filters.order}`;
  const cached = await getCached(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await query(
    `SELECT * FROM players 
     ORDER BY ${filters.sortBy} ${filters.order.toUpperCase()}
     LIMIT $1 OFFSET $2`,
    [filters.limit, offset]
  );
  
  const response = {
    players: result.rows,
    page: filters.page,
    limit: filters.limit,
    total: result.rowCount
  };
  
  await setCached(cacheKey, JSON.stringify(response), 300);
  
  return response;
}

export async function searchPlayers(filters: SearchFilters) {
  let queryStr = 'SELECT * FROM players WHERE 1=1';
  const params: any[] = [];
  let paramCount = 0;
  
  if (filters.query) {
    paramCount++;
    queryStr += ` AND (username ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
    params.push(`%${filters.query}%`);
  }
  
  if (filters.country) {
    paramCount++;
    queryStr += ` AND country = $${paramCount}`;
    params.push(filters.country);
  }
  
  if (filters.title) {
    paramCount++;
    queryStr += ` AND title = $${paramCount}`;
    params.push(filters.title);
  }
  
  if (filters.minRating) {
    paramCount++;
    queryStr += ` AND current_ratings->>'classical' >= $${paramCount}`;
    params.push(filters.minRating);
  }
  
  if (filters.maxRating) {
    paramCount++;
    queryStr += ` AND current_ratings->>'classical' <= $${paramCount}`;
    params.push(filters.maxRating);
  }
  
  const result = await query(queryStr, params);
  return result.rows;
}

export async function getTopPlayers(category: string, limit: number) {
  const cacheKey = `top-players:${category}:${limit}`;
  const cached = await getCached(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await query(
    `SELECT * FROM players 
     WHERE current_ratings->>'${category}' IS NOT NULL
     ORDER BY (current_ratings->>'${category}')::int DESC
     LIMIT $1`,
    [limit]
  );
  
  await setCached(cacheKey, JSON.stringify(result.rows), 3600);
  
  return result.rows;
}

export async function getPlayerById(id: string) {
  const cacheKey = `player:${id}`;
  const cached = await getCached(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await query('SELECT * FROM players WHERE id = $1', [id]);
  
  if (result.rows.length > 0) {
    await setCached(cacheKey, JSON.stringify(result.rows[0]), 600);
    return result.rows[0];
  }
  
  return null;
}

export async function getPlayerGames(playerId: string, filters: GameFilters) {
  const offset = (filters.page - 1) * filters.limit;
  
  let queryStr = `
    SELECT * FROM games 
    WHERE (white_player_id = $1 OR black_player_id = $1)
  `;
  const params: any[] = [playerId];
  let paramCount = 1;
  
  if (filters.opening) {
    paramCount++;
    queryStr += ` AND opening_name ILIKE $${paramCount}`;
    params.push(`%${filters.opening}%`);
  }
  
  if (filters.result) {
    paramCount++;
    queryStr += ` AND result = $${paramCount}`;
    params.push(filters.result);
  }
  
  if (filters.timeControl) {
    paramCount++;
    queryStr += ` AND time_control = $${paramCount}`;
    params.push(filters.timeControl);
  }
  
  paramCount++;
  queryStr += ` ORDER BY played_at DESC LIMIT $${paramCount}`;
  params.push(filters.limit);
  
  paramCount++;
  queryStr += ` OFFSET $${paramCount}`;
  params.push(offset);
  
  const result = await query(queryStr, params);
  
  return {
    games: result.rows,
    page: filters.page,
    limit: filters.limit,
    total: result.rowCount
  };
}

export async function getPlayerStatistics(playerId: string) {
  const stats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    averageGameLength: 0,
    mostPlayedOpening: '',
    currentRating: 0,
    peakRating: 0
  };
  
  return stats;
}

export async function getPlayerRatingHistory(playerId: string, category: string, period: string) {
  const result = await query(
    `SELECT * FROM ratings_history 
     WHERE player_id = $1 AND rating_type = $2
     ORDER BY recorded_at DESC`,
    [playerId, category]
  );
  
  return result.rows;
}

export async function getPlayerOpenings(playerId: string, color: string) {
  const openings: any[] = [];
  return openings;
}

export async function createPlayer(playerData: any) {
  const result = await query(
    `INSERT INTO players (username, full_name, country, title, fide_id, current_ratings, peak_ratings)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      playerData.username,
      playerData.fullName,
      playerData.country,
      playerData.title,
      playerData.fideId,
      JSON.stringify(playerData.currentRatings || {}),
      JSON.stringify(playerData.peakRatings || {})
    ]
  );
  
  return result.rows[0];
}

export async function updatePlayer(id: string, playerData: any) {
  const result = await query(
    `UPDATE players 
     SET username = $2, full_name = $3, country = $4, title = $5, 
         current_ratings = $6, peak_ratings = $7, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      playerData.username,
      playerData.fullName,
      playerData.country,
      playerData.title,
      JSON.stringify(playerData.currentRatings || {}),
      JSON.stringify(playerData.peakRatings || {})
    ]
  );
  
  if (result.rows.length > 0) {
    await deleteCached(`player:${id}`);
    return result.rows[0];
  }
  
  return null;
}

export async function deletePlayer(id: string) {
  const result = await query('DELETE FROM players WHERE id = $1 RETURNING id', [id]);
  
  if (result.rows.length > 0) {
    await deleteCached(`player:${id}`);
    return true;
  }
  
  return false;
}