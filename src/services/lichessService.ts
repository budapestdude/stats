import axios from 'axios';
import { query } from '../config/database';

const LICHESS_API = 'https://lichess.org/api';

interface LichessPlayer {
  id: string;
  username: string;
  title?: string;
  online: boolean;
  perfs: {
    classical?: { rating: number; games: number; prog: number };
    rapid?: { rating: number; games: number; prog: number };
    blitz?: { rating: number; games: number; prog: number };
    bullet?: { rating: number; games: number; prog: number };
  };
  profile?: {
    country?: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
    fideRating?: number;
  };
  createdAt: number;
  seenAt: number;
}

export class LichessService {
  private static async fetchFromAPI(endpoint: string, params?: any, retries = 3) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(`${LICHESS_API}${endpoint}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': process.env.LICHESS_API_TOKEN ?
              `Bearer ${process.env.LICHESS_API_TOKEN}` : undefined,
          },
          params,
        });

        // Validate response structure
        if (response.data === undefined) {
          throw new Error('Invalid API response: empty data');
        }

        return response.data;
      } catch (error: any) {
        lastError = error;

        // Handle rate limiting (429)
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          console.warn(`Rate limited by Lichess API. Retrying after ${retryAfter}s...`);
          await this.delay(retryAfter * 1000);
          continue;
        }

        // Handle server errors (500-599) with exponential backoff
        if (error.response?.status >= 500 && attempt < retries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Lichess API server error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
          await this.delay(backoffTime);
          continue;
        }

        // Don't retry client errors (400-499, except 429)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          console.error(`Lichess API client error for ${endpoint}:`, error.response?.status, error.response?.data);
          throw error;
        }

        // Network errors - retry with backoff
        if (attempt < retries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000;
          console.warn(`Lichess API network error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
          await this.delay(backoffTime);
          continue;
        }
      }
    }

    console.error(`Lichess API error for ${endpoint} after ${retries} attempts:`, lastError);
    throw lastError;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async getPlayer(username: string): Promise<LichessPlayer> {
    const data = await this.fetchFromAPI(`/user/${username}`);

    // Validate player data structure
    if (!data.id || !data.username) {
      throw new Error('Invalid player data: missing required fields');
    }

    return data;
  }

  static async getPlayerGames(username: string, max = 100) {
    const response = await axios.get(
      `${LICHESS_API}/games/user/${username}`,
      {
        headers: {
          'Accept': 'application/x-ndjson',
          'Authorization': process.env.LICHESS_API_TOKEN ? 
            `Bearer ${process.env.LICHESS_API_TOKEN}` : undefined,
        },
        params: {
          max,
          perfType: 'classical,rapid,blitz,bullet',
          pgnInJson: true,
          opening: true,
          rated: true,
        },
        responseType: 'text',
      }
    );

    const games = response.data
      .trim()
      .split('\n')
      .filter((line: string) => line)
      .map((line: string) => JSON.parse(line));

    return games;
  }

  static async syncPlayer(username: string) {
    try {
      const playerData = await this.getPlayer(username);

      const currentRatings: any = {};
      const peakRatings: any = {};

      if (playerData.perfs.classical) {
        currentRatings.classical = playerData.perfs.classical.rating;
      }
      if (playerData.perfs.rapid) {
        currentRatings.rapid = playerData.perfs.rapid.rating;
      }
      if (playerData.perfs.blitz) {
        currentRatings.blitz = playerData.perfs.blitz.rating;
      }
      if (playerData.perfs.bullet) {
        currentRatings.bullet = playerData.perfs.bullet.rating;
      }

      const fullName = playerData.profile?.firstName || playerData.profile?.lastName
        ? `${playerData.profile.firstName || ''} ${playerData.profile.lastName || ''}`.trim()
        : null;

      const existingPlayer = await query(
        'SELECT id FROM players WHERE lichess_username = $1',
        [username]
      );

      if (existingPlayer.rows.length > 0) {
        await query(
          `UPDATE players 
           SET full_name = $2, country = $3, title = $4, 
               current_ratings = $5, fide_id = $6, updated_at = NOW()
           WHERE lichess_username = $1
           RETURNING *`,
          [
            username,
            fullName,
            playerData.profile?.country,
            playerData.title,
            JSON.stringify(currentRatings),
            playerData.profile?.fideRating,
          ]
        );
      } else {
        await query(
          `INSERT INTO players (username, lichess_username, full_name, country, title, current_ratings, fide_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            username,
            username,
            fullName,
            playerData.profile?.country,
            playerData.title,
            JSON.stringify(currentRatings),
            playerData.profile?.fideRating,
          ]
        );
      }

      await this.saveRatingHistory(username, currentRatings);

      return { success: true, username };
    } catch (error) {
      console.error(`Failed to sync Lichess player ${username}:`, error);
      throw error;
    }
  }

  private static async saveRatingHistory(username: string, ratings: any) {
    const player = await query(
      'SELECT id FROM players WHERE lichess_username = $1',
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
      const games = await this.getPlayerGames(username, limit);
      let imported = 0;

      for (const game of games) {
        await this.saveGame(game, username);
        imported++;
      }

      return { imported };
    } catch (error) {
      console.error(`Failed to import Lichess games for ${username}:`, error);
      throw error;
    }
  }

  private static async saveGame(gameData: any, username: string) {
    try {
      const whiteUsername = gameData.players.white.user?.id;
      const blackUsername = gameData.players.black.user?.id;

      if (!whiteUsername || !blackUsername) return;

      const [whitePlayer, blackPlayer] = await Promise.all([
        query('SELECT id FROM players WHERE lichess_username = $1', [whiteUsername]),
        query('SELECT id FROM players WHERE lichess_username = $1', [blackUsername]),
      ]);

      const gameExists = await query(
        'SELECT id FROM games WHERE site = $1 AND event_name = $2',
        ['lichess.org', gameData.id]
      );

      if (gameExists.rows.length > 0) return;

      const result = gameData.winner === 'white' ? '1-0' :
                     gameData.winner === 'black' ? '0-1' : '1/2-1/2';

      await query(
        `INSERT INTO games (
          white_player_id, black_player_id, pgn, eco, opening_name,
          result, white_elo, black_elo, time_control, termination,
          rated, played_at, site, event_name, ply_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          whitePlayer.rows[0]?.id || null,
          blackPlayer.rows[0]?.id || null,
          gameData.pgn,
          gameData.opening?.eco,
          gameData.opening?.name,
          result,
          gameData.players.white.rating,
          gameData.players.black.rating,
          gameData.speed,
          gameData.status,
          gameData.rated,
          new Date(gameData.createdAt),
          'lichess.org',
          gameData.id,
          gameData.moves?.split(' ').length || 0,
        ]
      );
    } catch (error) {
      console.error('Failed to save Lichess game:', error);
    }
  }

  static async getTop50(perfType = 'classical') {
    return this.fetchFromAPI(`/player/top/50/${perfType}`);
  }

  static async getOpeningExplorer(fen: string, play?: string[]) {
    const params: any = { fen };
    if (play && play.length > 0) {
      params.play = play.join(',');
    }
    return this.fetchFromAPI('/opening/explorer', params);
  }

  static async getTournaments(state = 'created') {
    return this.fetchFromAPI('/tournament', { state });
  }

  static async streamGames(callback: (game: any) => void) {
    const eventSource = new (require('eventsource'))(
      `${LICHESS_API}/stream/games`,
      {
        headers: {
          'Authorization': process.env.LICHESS_API_TOKEN ? 
            `Bearer ${process.env.LICHESS_API_TOKEN}` : undefined,
        },
      }
    );

    eventSource.onmessage = (event: any) => {
      if (event.data) {
        try {
          const game = JSON.parse(event.data);
          callback(game);
        } catch (error) {
          console.error('Failed to parse game stream data:', error);
        }
      }
    };

    eventSource.onerror = (error: any) => {
      console.error('Game stream error:', error);
      eventSource.close();
    };

    return eventSource;
  }
}