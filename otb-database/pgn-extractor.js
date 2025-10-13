const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Extracts a specific game's PGN moves from a PGN file
 * Searches for game by white player, black player, result, and date
 */
class PGNExtractor {
  constructor(pgnDirectory = path.join(__dirname, 'pgn-files')) {
    this.pgnDirectory = pgnDirectory;
  }

  /**
   * Extract PGN moves for a specific game
   * @param {string} pgnFileName - Name of the PGN file (e.g., "LumbrasGigaBase_OTB_2020-2024.pgn")
   * @param {string} white - White player name
   * @param {string} black - Black player name
   * @param {string} result - Game result (1-0, 0-1, 1/2-1/2)
   * @param {string} date - Game date (YYYY.MM.DD format)
   * @returns {Promise<string|null>} - PGN moves or null if not found
   */
  async extractGame(pgnFileName, white, black, result, date) {
    const filePath = path.join(this.pgnDirectory, pgnFileName);

    if (!fs.existsSync(filePath)) {
      console.log(`PGN file not found: ${filePath}`);
      return null;
    }

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = {
        white: null,
        black: null,
        result: null,
        date: null,
        moves: []
      };
      let inGame = false;
      let foundMatch = false;

      rl.on('line', (line) => {
        // Parse headers
        if (line.startsWith('[White ')) {
          const match = line.match(/\[White "(.+)"\]/);
          currentGame.white = match ? match[1] : null;
        } else if (line.startsWith('[Black ')) {
          const match = line.match(/\[Black "(.+)"\]/);
          currentGame.black = match ? match[1] : null;
        } else if (line.startsWith('[Result ')) {
          const match = line.match(/\[Result "(.+)"\]/);
          currentGame.result = match ? match[1] : null;
        } else if (line.startsWith('[Date ')) {
          const match = line.match(/\[Date "(.+)"\]/);
          currentGame.date = match ? match[1] : null;
        } else if (line.trim() === '') {
          // Empty line after headers - next line starts moves
          inGame = true;
        } else if (inGame && line.trim() !== '') {
          // This is the moves line
          currentGame.moves.push(line.trim());

          // Check if this is the game we're looking for
          if (this.matchesGame(currentGame, white, black, result, date)) {
            foundMatch = true;
            const pgnMoves = currentGame.moves.join(' ');
            rl.close();
            fileStream.destroy();
            resolve(pgnMoves);
            return;
          }

          // Reset for next game
          currentGame = {
            white: null,
            black: null,
            result: null,
            date: null,
            moves: []
          };
          inGame = false;
        }
      });

      rl.on('close', () => {
        if (!foundMatch) {
          resolve(null);
        }
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Check if current game matches search criteria
   */
  matchesGame(game, white, black, result, date) {
    // Normalize date formats (handle both YYYY.MM.DD and YYYY-MM-DD)
    const normalizeDate = (d) => d ? d.replace(/\./g, '-').substring(0, 10) : null;

    const gameDate = normalizeDate(game.date);
    const searchDate = normalizeDate(date);

    return (
      game.white === white &&
      game.black === black &&
      game.result === result &&
      (!searchDate || gameDate === searchDate || gameDate?.startsWith(searchDate))
    );
  }

  /**
   * Extract multiple games matching criteria
   * @param {string} pgnFileName - Name of the PGN file
   * @param {Object} criteria - Search criteria { white?, black?, result?, date? }
   * @param {number} limit - Maximum number of games to return
   * @returns {Promise<Array>} - Array of { white, black, result, date, moves }
   */
  async extractGames(pgnFileName, criteria = {}, limit = 10) {
    const filePath = path.join(this.pgnDirectory, pgnFileName);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = {
        white: null,
        black: null,
        result: null,
        date: null,
        moves: []
      };
      let inGame = false;
      const matches = [];

      rl.on('line', (line) => {
        if (line.startsWith('[White ')) {
          const match = line.match(/\[White "(.+)"\]/);
          currentGame.white = match ? match[1] : null;
        } else if (line.startsWith('[Black ')) {
          const match = line.match(/\[Black "(.+)"\]/);
          currentGame.black = match ? match[1] : null;
        } else if (line.startsWith('[Result ')) {
          const match = line.match(/\[Result "(.+)"\]/);
          currentGame.result = match ? match[1] : null;
        } else if (line.startsWith('[Date ')) {
          const match = line.match(/\[Date "(.+)"\]/);
          currentGame.date = match ? match[1] : null;
        } else if (line.trim() === '') {
          inGame = true;
        } else if (inGame && line.trim() !== '') {
          currentGame.moves.push(line.trim());

          // Check if matches criteria
          if (this.matchesCriteria(currentGame, criteria)) {
            matches.push({
              white: currentGame.white,
              black: currentGame.black,
              result: currentGame.result,
              date: currentGame.date,
              moves: currentGame.moves.join(' ')
            });

            if (matches.length >= limit) {
              rl.close();
              fileStream.destroy();
              resolve(matches);
              return;
            }
          }

          currentGame = {
            white: null,
            black: null,
            result: null,
            date: null,
            moves: []
          };
          inGame = false;
        }
      });

      rl.on('close', () => {
        resolve(matches);
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Check if game matches partial criteria
   */
  matchesCriteria(game, criteria) {
    if (criteria.white && !game.white?.includes(criteria.white)) return false;
    if (criteria.black && !game.black?.includes(criteria.black)) return false;
    if (criteria.result && game.result !== criteria.result) return false;
    if (criteria.date) {
      const normalizeDate = (d) => d ? d.replace(/\./g, '-') : null;
      const gameDate = normalizeDate(game.date);
      const searchDate = normalizeDate(criteria.date);
      if (!gameDate?.startsWith(searchDate)) return false;
    }
    return true;
  }
}

module.exports = PGNExtractor;
