/**
 * Enhanced PGN Parser with Name Normalization
 * Properly handles player name variations during import
 */

const fs = require('fs');
const readline = require('readline');
const NameNormalizer = require('./name-normalizer');

class EnhancedPGNParser {
  constructor() {
    this.nameNormalizer = new NameNormalizer();
    this.games = [];
    this.currentGame = null;
    this.moveText = '';
    this.inMoves = false;
    
    // Statistics
    this.stats = {
      totalGames: 0,
      normalizedNames: new Set(),
      nameVariations: {},
      errors: []
    };
  }

  /**
   * Parse a PGN header tag
   */
  parseTag(line) {
    const match = line.match(/^\[(\w+)\s+"([^"]*)"\]/);
    if (match) {
      const [, key, value] = match;
      
      // Normalize player names
      if (key === 'White' || key === 'Black') {
        const originalName = value;
        const normalizedName = this.nameNormalizer.normalize(value);
        
        // Track statistics
        this.stats.normalizedNames.add(normalizedName);
        if (!this.stats.nameVariations[normalizedName]) {
          this.stats.nameVariations[normalizedName] = new Set();
        }
        this.stats.nameVariations[normalizedName].add(originalName);
        
        // Store both original and normalized
        this.currentGame[key] = normalizedName;
        this.currentGame[`${key}Original`] = originalName;
      } else {
        this.currentGame[key] = value;
      }
    }
  }

  /**
   * Parse a single line of PGN
   */
  parseLine(line) {
    line = line.trim();
    
    // Skip empty lines
    if (!line) {
      if (this.inMoves && this.currentGame) {
        // End of game
        this.finalizeGame();
      }
      return;
    }
    
    // Comment
    if (line.startsWith(';') || line.startsWith('%')) {
      return;
    }
    
    // Header tag
    if (line.startsWith('[')) {
      if (!this.currentGame) {
        this.currentGame = {};
      }
      this.inMoves = false;
      this.parseTag(line);
      return;
    }
    
    // Move text
    if (this.currentGame && !line.startsWith('[')) {
      this.inMoves = true;
      this.moveText += ' ' + line;
    }
  }

  /**
   * Finalize the current game
   */
  finalizeGame() {
    if (this.currentGame) {
      this.currentGame.moves = this.moveText.trim();
      this.games.push(this.currentGame);
      this.stats.totalGames++;
      
      // Log progress for large files
      if (this.stats.totalGames % 1000 === 0) {
        console.log(`Parsed ${this.stats.totalGames} games...`);
      }
    }
    
    this.currentGame = null;
    this.moveText = '';
    this.inMoves = false;
  }

  /**
   * Parse a PGN file
   */
  async parseFile(filePath, options = {}) {
    const { limit = Infinity, playerFilter = null } = options;
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        try {
          this.parseLine(line);
          
          // Check if we've reached the limit
          if (this.stats.totalGames >= limit) {
            rl.close();
          }
        } catch (error) {
          this.stats.errors.push({
            line: line,
            error: error.message,
            gameNumber: this.stats.totalGames + 1
          });
        }
      });
      
      rl.on('close', () => {
        // Finalize last game if any
        if (this.currentGame) {
          this.finalizeGame();
        }
        
        // Filter by player if specified
        if (playerFilter) {
          const normalizedFilter = this.nameNormalizer.normalize(playerFilter);
          this.games = this.games.filter(game => 
            game.White === normalizedFilter || game.Black === normalizedFilter
          );
        }
        
        resolve({
          games: this.games,
          stats: this.getStatistics()
        });
      });
      
      rl.on('error', reject);
    });
  }

  /**
   * Get parsing statistics
   */
  getStatistics() {
    // Convert sets to arrays for JSON serialization
    const variations = {};
    for (const [name, varSet] of Object.entries(this.stats.nameVariations)) {
      variations[name] = Array.from(varSet);
    }
    
    return {
      totalGames: this.stats.totalGames,
      uniquePlayers: this.stats.normalizedNames.size,
      nameVariations: variations,
      errors: this.stats.errors
    };
  }

  /**
   * Find specific player's games with all name variations
   */
  findPlayerGames(playerName) {
    const normalizedName = this.nameNormalizer.normalize(playerName);
    return this.games.filter(game => 
      game.White === normalizedName || game.Black === normalizedName
    );
  }

  /**
   * Export games in a database-ready format
   */
  exportForDatabase() {
    return this.games.map(game => ({
      event: game.Event || '',
      site: game.Site || '',
      date: game.Date || '',
      round: game.Round || '',
      white: game.White || '',
      black: game.Black || '',
      result: game.Result || '*',
      whiteElo: parseInt(game.WhiteElo) || null,
      blackElo: parseInt(game.BlackElo) || null,
      eco: game.ECO || '',
      opening: game.Opening || '',
      variation: game.Variation || '',
      moves: game.moves || '',
      timeControl: game.TimeControl || '',
      termination: game.Termination || '',
      plyCount: parseInt(game.PlyCount) || null,
      // Keep original names for reference
      whiteOriginal: game.WhiteOriginal || game.White,
      blackOriginal: game.BlackOriginal || game.Black
    }));
  }
}

// Test the enhanced parser
async function testParser() {
  const parser = new EnhancedPGNParser();
  
  console.log('Testing Enhanced PGN Parser with Name Normalization');
  console.log('=' . repeat(60));
  
  // Test with world_champions.pgn first (smaller file)
  const testFile = 'C:\\Users\\micha\\OneDrive\\Desktop\\Code\\Chess Stats\\otb-database\\pgn-files\\world_champions.pgn';
  
  if (fs.existsSync(testFile)) {
    console.log(`Parsing ${testFile}...`);
    
    const result = await parser.parseFile(testFile, {
      limit: 10 // Parse first 10 games for testing
    });
    
    console.log('\nParsing Statistics:');
    console.log(`Total games parsed: ${result.stats.totalGames}`);
    console.log(`Unique players: ${result.stats.uniquePlayers}`);
    console.log(`Errors: ${result.stats.errors.length}`);
    
    console.log('\nName Variations Found:');
    for (const [canonical, variations] of Object.entries(result.stats.nameVariations)) {
      if (variations.length > 1) {
        console.log(`${canonical}:`);
        variations.forEach(v => console.log(`  - ${v}`));
      }
    }
    
    // Check for Fischer games
    const fischerGames = parser.findPlayerGames('Fischer');
    console.log(`\nFischer games found: ${fischerGames.length}`);
    
    if (fischerGames.length > 0) {
      console.log('First Fischer game:');
      const game = fischerGames[0];
      console.log(`  Event: ${game.Event}`);
      console.log(`  Date: ${game.Date}`);
      console.log(`  White: ${game.White} (original: ${game.WhiteOriginal})`);
      console.log(`  Black: ${game.Black} (original: ${game.BlackOriginal})`);
      console.log(`  Result: ${game.Result}`);
    }
  } else {
    console.log('Test file not found. Testing with sample data...');
    
    // Test with sample PGN data
    const samplePGN = `
[Event "World Championship"]
[Site "Reykjavik ISL"]
[Date "1972.07.11"]
[Round "1"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0

[Event "Candidates"]
[White "Fischer, R."]
[Black "Petrosian, T."]
[Result "1-0"]

1. e4 c5 1-0

[Event "US Championship"]
[White "Bobby Fischer"]
[Black "Reshevsky, Samuel"]
[Result "1/2-1/2"]

1. d4 d5 1/2-1/2
`;
    
    // Write sample to temp file
    const tempFile = 'temp-test.pgn';
    fs.writeFileSync(tempFile, samplePGN);
    
    const result = await parser.parseFile(tempFile);
    
    console.log('\nParsing Results:');
    console.log(JSON.stringify(result.stats, null, 2));
    
    console.log('\nGames found:');
    result.games.forEach((game, i) => {
      console.log(`Game ${i + 1}: ${game.White} vs ${game.Black} - ${game.Result}`);
    });
    
    // Clean up
    fs.unlinkSync(tempFile);
  }
}

module.exports = EnhancedPGNParser;

// Run test if executed directly
if (require.main === module) {
  testParser().catch(console.error);
}