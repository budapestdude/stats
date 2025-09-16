const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Add indexes for faster searches
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_white_player ON games(white_player)',
    'CREATE INDEX IF NOT EXISTS idx_black_player ON games(black_player)',
    'CREATE INDEX IF NOT EXISTS idx_date ON games(date)',
    'CREATE INDEX IF NOT EXISTS idx_tournament ON games(tournament_name)'
  ];
  
  let completed = 0;
  indexes.forEach((sql, index) => {
    console.log(`Creating index ${index + 1}/${indexes.length}...`);
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating index: ${err}`);
      } else {
        console.log(`Index ${index + 1} created successfully`);
      }
      completed++;
      if (completed === indexes.length) {
        console.log('All indexes created');
        db.close();
      }
    });
  });
});