// Check if Railway database has indexes
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'complete-tournaments.db')
  : path.join(__dirname, 'otb-database', 'complete-tournaments.db');

console.log('Checking database indexes...');
console.log('Database path:', dbPath);
console.log('');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  db.all('SELECT name, sql FROM sqlite_master WHERE type="index" AND name LIKE "idx_%"', [], (err, rows) => {
    if (err) {
      console.error('Error querying indexes:', err);
      db.close();
      process.exit(1);
    }

    console.log(`Found ${rows.length} indexes:\n`);
    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name}`);
      console.log(`   ${row.sql}\n`);
    });

    db.close();
  });
});
