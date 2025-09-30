/**
 * Quick verification script to check if Fischer games were properly imported
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function verifyFischerImport() {
  const dbPath = path.join(__dirname, 'chess-stats.db');
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    
    console.log('Fischer Import Verification');
    console.log('=' . repeat(50));
    
    // Check total Fischer games
    db.get(`
      SELECT COUNT(*) as count 
      FROM games 
      WHERE white = 'Fischer, Robert James' 
         OR black = 'Fischer, Robert James'
    `, (err, row) => {
      if (err) {
        console.error('Error:', err.message);
        return;
      }
      console.log(`\nTotal Fischer games: ${row.count}`);
      
      // Check games by color
      db.get(`
        SELECT 
          SUM(CASE WHEN white = 'Fischer, Robert James' THEN 1 ELSE 0 END) as white_games,
          SUM(CASE WHEN black = 'Fischer, Robert James' THEN 1 ELSE 0 END) as black_games
        FROM games 
        WHERE white = 'Fischer, Robert James' OR black = 'Fischer, Robert James'
      `, (err, row) => {
        if (err) {
          console.error('Error:', err.message);
          return;
        }
        console.log(`  As White: ${row.white_games}`);
        console.log(`  As Black: ${row.black_games}`);
        
        // Check results
        db.get(`
          SELECT 
            SUM(CASE WHEN white = 'Fischer, Robert James' AND result = '1-0' THEN 1 
                     WHEN black = 'Fischer, Robert James' AND result = '0-1' THEN 1 
                     ELSE 0 END) as wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN white = 'Fischer, Robert James' AND result = '0-1' THEN 1 
                     WHEN black = 'Fischer, Robert James' AND result = '1-0' THEN 1 
                     ELSE 0 END) as losses
          FROM games 
          WHERE white = 'Fischer, Robert James' OR black = 'Fischer, Robert James'
        `, (err, row) => {
          if (err) {
            console.error('Error:', err.message);
            return;
          }
          console.log(`\nResults:`);
          console.log(`  Wins: ${row.wins}`);
          console.log(`  Draws: ${row.draws}`);
          console.log(`  Losses: ${row.losses}`);
          
          // Check name variations found
          db.all(`
            SELECT alias, occurrences 
            FROM player_aliases 
            WHERE canonical_name = 'Fischer, Robert James'
            ORDER BY occurrences DESC
            LIMIT 10
          `, (err, rows) => {
            if (err) {
              console.error('Error:', err.message);
              return;
            }
            
            if (rows && rows.length > 0) {
              console.log(`\nName variations found (${rows.length} total):`);
              rows.forEach(row => {
                console.log(`  "${row.alias}" - ${row.occurrences} occurrences`);
              });
            }
            
            // Sample games
            db.all(`
              SELECT event, date, white_original, black_original, result
              FROM games 
              WHERE white = 'Fischer, Robert James' OR black = 'Fischer, Robert James'
              ORDER BY date DESC
              LIMIT 5
            `, (err, rows) => {
              if (err) {
                console.error('Error:', err.message);
                return;
              }
              
              if (rows && rows.length > 0) {
                console.log(`\nSample Fischer games:`);
                rows.forEach(row => {
                  console.log(`  ${row.date}: ${row.white_original} vs ${row.black_original} (${row.result}) - ${row.event}`);
                });
              }
              
              // Check database totals
              db.get('SELECT COUNT(*) as total FROM games', (err, row) => {
                if (err) {
                  console.error('Error:', err.message);
                  return;
                }
                console.log(`\nTotal games in database: ${row.total}`);
                
                db.get('SELECT COUNT(*) as players FROM players', (err, row) => {
                  if (err) {
                    console.error('Error:', err.message);
                    return;
                  }
                  console.log(`Total unique players: ${row.players}`);
                  
                  console.log('\n' + '=' . repeat(50));
                  console.log('Verification complete!');
                  
                  db.close();
                });
              });
            });
          });
        });
      });
    });
  });
}

// Run verification
verifyFischerImport();