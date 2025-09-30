const fs = require('fs');
const path = require('path');

const processedDir = path.join(__dirname, 'processed');
const files = fs.readdirSync(processedDir)
  .filter(f => f.endsWith('-enhanced-stats.json'));

console.log('\nAvailable Player Statistics:');
console.log('='.repeat(70));
console.log('Player'.padEnd(22) + '| Games  | Classical | Rapid | Blitz | Win Rate');
console.log('-'.repeat(70));

files.forEach(f => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(processedDir, f)));
    const tc = data.timeControlCategories || {};
    console.log(
      data.player.padEnd(22) + '| ' +
      String(data.overview.totalGames).padStart(6) + ' | ' +
      String(tc.classical?.games || 0).padStart(9) + ' | ' +
      String(tc.rapid?.games || 0).padStart(5) + ' | ' +
      String(tc.blitz?.games || 0).padStart(5) + ' | ' +
      data.overview.winRate.padStart(6) + '%'
    );
  } catch (e) {
    console.log(`Error reading ${f}: ${e.message}`);
  }
});

console.log('='.repeat(70));