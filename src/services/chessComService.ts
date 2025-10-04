import axios from 'axios';
import { query } from '../config/database';

const CHESS_COM_API = 'https://api.chess.com/pub';

interface ChessComPlayer {
  username: string;
  player_id: number;
  title?: string;
  status: string;
  name?: string;
  country: string;
  followers: number;
  joined: number;
  last_online: number;
}

interface ChessComStats {
  chess_rapid?: {
    last: { rating: number; date: number };
    best: { rating: number; date: number };
    record: { win: number; loss: number; draw: number };
  };
  chess_blitz?: {
    last: { rating: number; date: number };
    best: { rating: number; date: number };
    record: { win: number; loss: number; draw: number };
  };
  chess_bullet?: {
    last: { rating: number; date: number };
    best: { rating: number; date: number };
    record: { win: number; loss: number; draw: number };
  };
}

export class ChessComService {
  private static async fetchFromAPI(endpoint: string, retries = 3) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(`${CHESS_COM_API}${endpoint}`, {
          headers: {
            'User-Agent': 'Chess-Stats-Platform/1.0',
          },
        });

        // Validate response structure
        if (!response.data) {
          throw new Error('Invalid API response: empty data');
        }

        return response.data;
      } catch (error: any) {
        lastError = error;

        // Handle rate limiting (429)
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          console.warn(`Rate limited by Chess.com API. Retrying after ${retryAfter}s...`);
          await this.delay(retryAfter * 1000);
          continue;
        }

        // Handle server errors (500-599) with exponential backoff
        if (error.response?.status >= 500 && attempt < retries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Chess.com API server error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
          await this.delay(backoffTime);
          continue;
        }

        // Don't retry client errors (400-499, except 429)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          console.error(`Chess.com API client error for ${endpoint}:`, error.response?.status, error.response?.data);
          throw error;
        }

        // Network errors - retry with backoff
        if (attempt < retries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000;
          console.warn(`Chess.com API network error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
          await this.delay(backoffTime);
          continue;
        }
      }
    }

    console.error(`Chess.com API error for ${endpoint} after ${retries} attempts:`, lastError);
    throw lastError;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async getPlayer(username: string): Promise<ChessComPlayer> {
    const data = await this.fetchFromAPI(`/player/${username}`);

    // Validate player data structure
    if (!data.username) {
      throw new Error('Invalid player data: missing username');
    }

    return data;
  }

  static async getPlayerStats(username: string): Promise<ChessComStats> {
    const data = await this.fetchFromAPI(`/player/${username}/stats`);

    // Validate stats structure - Chess.com returns empty object if no games
    if (typeof data !== 'object') {
      throw new Error('Invalid stats data: expected object');
    }

    return data;
  }

  static async getPlayerGames(username: string, year: number, month: number) {
    const monthStr = month.toString().padStart(2, '0');
    return this.fetchFromAPI(`/player/${username}/games/${year}/${monthStr}`);
  }

  static async getPlayerCurrentGames(username: string) {
    return this.fetchFromAPI(`/player/${username}/games`);
  }

  static async syncPlayer(username: string) {
    try {
      const [playerData, statsData] = await Promise.all([
        this.getPlayer(username),
        this.getPlayerStats(username),
      ]);

      const currentRatings: any = {};
      const peakRatings: any = {};

      if (statsData.chess_rapid) {
        currentRatings.rapid = statsData.chess_rapid.last?.rating;
        peakRatings.rapid = statsData.chess_rapid.best?.rating;
      }

      if (statsData.chess_blitz) {
        currentRatings.blitz = statsData.chess_blitz.last?.rating;
        peakRatings.blitz = statsData.chess_blitz.best?.rating;
      }

      if (statsData.chess_bullet) {
        currentRatings.bullet = statsData.chess_bullet.last?.rating;
        peakRatings.bullet = statsData.chess_bullet.best?.rating;
      }

      const countryCode = playerData.country?.split('/')?.pop() || null;

      const existingPlayer = await query(
        'SELECT id FROM players WHERE chess_com_username = $1',
        [username]
      );

      if (existingPlayer.rows.length > 0) {
        await query(
          `UPDATE players 
           SET full_name = $2, country = $3, title = $4, 
               current_ratings = $5, peak_ratings = $6, updated_at = NOW()
           WHERE chess_com_username = $1
           RETURNING *`,
          [
            username,
            playerData.name,
            countryCode,
            playerData.title,
            JSON.stringify(currentRatings),
            JSON.stringify(peakRatings),
          ]
        );
      } else {
        await query(
          `INSERT INTO players (username, chess_com_username, full_name, country, title, current_ratings, peak_ratings)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            username,
            username,
            playerData.name,
            countryCode,
            playerData.title,
            JSON.stringify(currentRatings),
            JSON.stringify(peakRatings),
          ]
        );
      }

      await this.saveRatingHistory(username, currentRatings);

      return { success: true, username };
    } catch (error) {
      console.error(`Failed to sync player ${username}:`, error);
      throw error;
    }
  }

  private static async saveRatingHistory(username: string, ratings: any) {
    const player = await query(
      'SELECT id FROM players WHERE chess_com_username = $1',
      [username]
    );

    if (player.rows.length === 0) return;

    const playerId = player.rows[0].id;
    const now = new Date();

    for (const [type, rating] of Object.entries(ratings)) {
      if (rating) {
        await query(
          `INSERT INTO ratings_history (player_id, rating_type, rating, recorded_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [playerId, type, rating, now]
        );
      }
    }
  }

  static async importPlayerGames(username: string, limit = 100) {
    try {
      const currentDate = new Date();
      const games = [];
      let totalImported = 0;

      for (let i = 0; i < 6 && totalImported < limit; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1 - i;
        
        const monthlyGames = await this.getPlayerGames(username, year, month);
        
        if (monthlyGames.games) {
          for (const game of monthlyGames.games.slice(0, limit - totalImported)) {
            await this.saveGame(game);
            totalImported++;
          }
        }
      }

      return { imported: totalImported };
    } catch (error) {
      console.error(`Failed to import games for ${username}:`, error);
      throw error;
    }
  }

  private static async saveGame(gameData: any) {
    try {
      const whiteUsername = gameData.white.username;
      const blackUsername = gameData.black.username;

      const [whitePlayer, blackPlayer] = await Promise.all([
        query('SELECT id FROM players WHERE chess_com_username = $1', [whiteUsername]),
        query('SELECT id FROM players WHERE chess_com_username = $1', [blackUsername]),
      ]);

      const gameExists = await query(
        'SELECT id FROM games WHERE site = $1 AND event_name = $2 AND played_at = $3',
        ['chess.com', gameData.url, new Date(gameData.end_time * 1000)]
      );

      if (gameExists.rows.length > 0) return;

      await query(
        `INSERT INTO games (
          white_player_id, black_player_id, pgn, eco, opening_name,
          result, white_elo, black_elo, time_control, termination,
          rated, played_at, site, event_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          whitePlayer.rows[0]?.id || null,
          blackPlayer.rows[0]?.id || null,
          gameData.pgn,
          gameData.eco || null,
          null,
          gameData.white.result === 'win' ? '1-0' : 
            gameData.black.result === 'win' ? '0-1' : '1/2-1/2',
          gameData.white.rating,
          gameData.black.rating,
          gameData.time_class,
          gameData.termination,
          gameData.rated,
          new Date(gameData.end_time * 1000),
          'chess.com',
          gameData.url,
        ]
      );
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }

  static async getTitledPlayers() {
    return this.fetchFromAPI('/titled/GM');
  }

  static async getStreamers() {
    return this.fetchFromAPI('/streamers');
  }

  static async getLeaderboards() {
    return this.fetchFromAPI('/leaderboards');
  }
}