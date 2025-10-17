const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('otb-database/complete-tournaments.db', sqlite3.OPEN_READONLY);

const searchPatterns = [
  'magnus carlsen',
  'Magnus, Carlsen',
  'Carlsen, Magnus',
  'Magnus Carlsen'
];

console.log('Testing search patterns for Magnus Carlsen:\n');

searchPatterns.forEach((pattern, index) => {
  const query = `
    SELECT white_player as name FROM games WHERE white_player LIKE ?
    UNION
    SELECT black_player as name FROM games WHERE black_player LIKE ?
    LIMIT 1
  `;

  db.get(query, [`%${pattern}%`, `%${pattern}%`], (err, row) => {
    console.log(`Pattern ${index + 1}: "${pattern}"`);
    if (err) {
      console.log('  Error:', err.message);
    } else if (row) {
      console.log('  ✓ FOUND:', row.name);
    } else {
      console.log('  ✗ Not found');
    }
    console.log('');

    if (index === searchPatterns.length - 1) {
      db.close();
    }
  });
});
