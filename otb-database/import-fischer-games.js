/**
 * Quick import of just Fischer games from the 1970-1989 file
 */

const sqlite3 = require('sqlite3').verbose();
const EnhancedPGNParser = require('./enhanced-pgn-parser');
const path = require('path');

async function importFischerGames() {
  const parser = new EnhancedPGNParser();
  const dbPath = path.join(__dirname, 'chess-stats.db');
  const pgnFile = path.join(__dirname, 'pgn-files', 'LumbrasGigaBase_OTB_1970-1989.pgn');
  
  console.log('Importing Fischer games from 1970-1989 file');
  console.log('=' . repeat(50));
  
  // Parse the file filtering for Fischer games
  console.log('Parsing PGN file for Fischer games...');
  const result = await parser.parseFile(pgnFile, {
    playerFilter: 'Fischer, Robert'  // This will match all Fischer variations
  });
  
  console.log(`Found ${result.games.length} Fischer games!`);
  console.log(`Name variations detected: ${Object.keys(result.stats.nameVariations).length}`);
  
  // Import to database
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO games (
        event, site, date, round, 
        white, white_original, black, black_original,
        result, white_elo, black_elo, 
        eco, opening, variation, moves, 
        ply_count, time_control, termination
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const playerStmt = db.prepare(`
      INSERT OR IGNORE INTO players (canonical_name) VALUES (?)
    `);
    
    const aliasStmt = db.prepare(`
      INSERT OR REPLACE INTO player_aliases (canonical_name, alias, occurrences)
      VALUES (?, ?, COALESCE((SELECT occurrences FROM player_aliases WHERE alias = ?) + 1, 1))
    `);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let imported = 0;
      const games = parser.exportForDatabase.call({ games: result.games });
      
      for (const game of games) {
        try {
          stmt.run(
            game.event, game.site, game.date, game.round,
            game.white, game.whiteOriginal, game.black, game.blackOriginal,
            game.result, game.whiteElo, game.blackElo,
            game.eco, game.opening, game.variation, game.moves,
            game.plyCount, game.timeControl, game.termination
          );
          
          // Add players
          playerStmt.run(game.white);
          playerStmt.run(game.black);
          
          // Track aliases
          if (game.white === 'Fischer, Robert James' && game.whiteOriginal !== game.white) {
            aliasStmt.run(game.white, game.whiteOriginal, game.whiteOriginal);
          }
          if (game.black === 'Fischer, Robert James' && game.blackOriginal !== game.black) {
            aliasStmt.run(game.black, game.blackOriginal, game.blackOriginal);
          }
          
          imported++;
        } catch (error) {
          console.log(`Error importing game: ${error.message}`);
        }
      }
      
      db.run('COMMIT', (err) => {
        stmt.finalize();
        playerStmt.finalize();
        aliasStmt.finalize();
        
        if (err) {
          reject(err);
        } else {
          console.log(`\nSuccessfully imported ${imported} Fischer games!`);
          
          // Update player stats for Fischer
          db.run(`
            UPDATE players
            SET total_games = (
              SELECT COUNT(*) FROM games 
              WHERE white = 'Fischer, Robert James' 
                 OR black = 'Fischer, Robert James'
            ),
            wins_as_white = (
              SELECT COUNT(*) FROM games 
              WHERE white = 'Fischer, Robert James' 
                AND result = '1-0'
            ),
            wins_as_black = (
              SELECT COUNT(*) FROM games 
              WHERE black = 'Fischer, Robert James' 
                AND result = '0-1'
            ),
            draws = (
              SELECT COUNT(*) FROM games 
              WHERE (white = 'Fischer, Robert James' OR black = 'Fischer, Robert James')
                AND result = '1/2-1/2'
            )
            WHERE canonical_name = 'Fischer, Robert James'
          `, () => {
            db.close();
            resolve(imported);
          });
        }
      });
    });
  });
}

// Run the import
importFischerGames()
  .then(() => {
    console.log('\nRunning verification...\n');
    require('./verify-fischer-import');
  })
  .catch(console.error);