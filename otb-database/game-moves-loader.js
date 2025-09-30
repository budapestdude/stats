const fs = require('fs');
const readline = require('readline');
const path = require('path');

class GameMovesLoader {
  constructor(pgnDirectory = path.join(__dirname, 'pgn-files')) {
    this.pgnDirectory = pgnDirectory;
  }

  /**
   * Find and extract moves for a specific game from PGN files
   * @param {Object} gameData - Game metadata from database
   * @returns {Promise<string|null>} - PGN moves or null if not found
   */
  async findGameMoves(gameData) {
    const { pgn_file, white_player, black_player, date, eco } = gameData;
    
    if (!pgn_file) {
      return null;
    }

    const pgnPath = path.join(this.pgnDirectory, pgn_file);
    
    if (!fs.existsSync(pgnPath)) {
      console.warn(`PGN file not found: ${pgn_file}`);
      return null;
    }

    return await this.searchGameInFile(pgnPath, {
      white: white_player,
      black: black_player,
      date: date,
      eco: eco
    });
  }

  /**
   * Search for a specific game in a PGN file
   */
  async searchGameInFile(filePath, criteria) {
    return new Promise((resolve) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = [];
      let inGame = false;
      let headers = {};
      let moveText = '';
      let foundGame = false;

      rl.on('line', (line) => {
        if (foundGame) return;

        // Start of a new game (header line)
        if (line.startsWith('[')) {
          if (inGame && moveText) {
            // Check if previous game matches
            if (this.isMatchingGame(headers, criteria)) {
              foundGame = true;
              rl.close();
              resolve(moveText.trim());
              return;
            }
          }
          
          // Parse header
          const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
          if (match) {
            if (match[1] === 'Event') {
              // New game starting, reset
              headers = {};
              moveText = '';
              inGame = true;
            }
            headers[match[1]] = match[2];
          }
        } 
        // Move text
        else if (line.trim() && inGame) {
          moveText += line + ' ';
        }
        // Empty line often separates games
        else if (!line.trim() && inGame && moveText) {
          // Check if current game matches
          if (this.isMatchingGame(headers, criteria)) {
            foundGame = true;
            rl.close();
            resolve(moveText.trim());
            return;
          }
          // Reset for next game
          headers = {};
          moveText = '';
          inGame = false;
        }
      });

      rl.on('close', () => {
        // Check last game if needed
        if (!foundGame && inGame && moveText && this.isMatchingGame(headers, criteria)) {
          resolve(moveText.trim());
        } else if (!foundGame) {
          resolve(null);
        }
      });

      rl.on('error', (err) => {
        console.error('Error reading PGN file:', err);
        resolve(null);
      });
    });
  }

  /**
   * Check if game headers match the criteria
   */
  isMatchingGame(headers, criteria) {
    // Match by white and black players
    if (criteria.white && criteria.black) {
      const whiteMatches = headers.White && 
        this.normalizePlayerName(headers.White) === this.normalizePlayerName(criteria.white);
      const blackMatches = headers.Black && 
        this.normalizePlayerName(headers.Black) === this.normalizePlayerName(criteria.black);
      
      if (whiteMatches && blackMatches) {
        // Additional checks for date and ECO if available
        if (criteria.date && headers.Date) {
          const dateMatches = headers.Date.startsWith(criteria.date.substring(0, 4));
          if (!dateMatches) return false;
        }
        if (criteria.eco && headers.ECO) {
          const ecoMatches = headers.ECO.startsWith(criteria.eco.substring(0, 3));
          if (!ecoMatches) return false;
        }
        return true;
      }
    }
    
    return false;
  }

  /**
   * Normalize player names for comparison
   */
  normalizePlayerName(name) {
    return name.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean up PGN moves for display
   */
  cleanMoves(moveText) {
    return moveText
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '')  // Remove variations
      .replace(/\d+\.\.\./g, '')  // Remove move number indicators
      .replace(/\s+/g, ' ')        // Normalize spaces
      .trim();
  }
}

module.exports = GameMovesLoader;