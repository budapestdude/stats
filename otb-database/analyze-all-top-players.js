const fs = require('fs');
const path = require('path');
const { EnhancedPlayerAnalyzer } = require('./player-analyzer-enhanced');

const topPlayers = [
  'Garry Kasparov',
  'Anatoly Karpov',
  'Viswanathan Anand',
  'Vladimir Kramnik',
  'Fabiano Caruana',
  'Hikaru Nakamura',
  'Ian Nepomniachtchi',
  'Levon Aronian',
  'Bobby Fischer',
  'Ding Liren'
];

async function analyzePlayer(playerName) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Analyzing ${playerName}`);
  console.log('='.repeat(50));
  
  const analyzer = new EnhancedPlayerAnalyzer(playerName);
  const pgnDir = path.join(__dirname, 'pgn-files');
  const processedDir = path.join(__dirname, 'processed');
  
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const pgnFiles = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .sort();
  
  let totalGamesFound = 0;
  
  for (const file of pgnFiles) {
    const filePath = path.join(pgnDir, file);
    
    process.stdout.write(`Processing ${file}...`);
    const gamesFound = await analyzer.analyzeFile(filePath);
    
    if (gamesFound > 0) {
      console.log(` found ${gamesFound} games`);
      totalGamesFound += gamesFound;
    } else {
      // Clear the line if no games found
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
    }
  }
  
  if (totalGamesFound === 0) {
    console.log(`No games found for ${playerName}`);
    return null;
  }
  
  const stats = analyzer.getStats();
  console.log(`Total games for ${playerName}: ${stats.overview.totalGames}`);
  
  // Show time control distribution
  const tc = stats.timeControlCategories;
  console.log(`Time Controls: Classical ${tc.classical.games}, Rapid ${tc.rapid.games}, Blitz ${tc.blitz.games}, Online ${tc.online.games}`);
  
  const outputPath = path.join(processedDir, `${playerName.toLowerCase().replace(/\s+/g, '-')}-enhanced-stats.json`);
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  console.log(`Stats saved to ${outputPath}`);
  
  // Also save simplified stats for backward compatibility
  const simplifiedPath = path.join(processedDir, `${playerName.toLowerCase().replace(/\s+/g, '-')}-stats.json`);
  fs.writeFileSync(simplifiedPath, JSON.stringify(stats, null, 2));
  
  return stats;
}

async function analyzeAllPlayers() {
  console.log('Starting analysis of top 10 players...\n');
  const startTime = Date.now();
  const results = [];
  
  for (const playerName of topPlayers) {
    const stats = await analyzePlayer(playerName);
    if (stats) {
      results.push({
        name: playerName,
        games: stats.overview.totalGames,
        winRate: stats.overview.winRate,
        classical: stats.timeControlCategories.classical.games,
        rapid: stats.timeControlCategories.rapid.games,
        blitz: stats.timeControlCategories.blitz.games
      });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(50));
  console.log('\nSummary:');
  console.log('-'.repeat(50));
  
  results.forEach(player => {
    console.log(`${player.name.padEnd(20)} | ${String(player.games).padStart(5)} games | Win: ${player.winRate}% | C:${player.classical} R:${player.rapid} B:${player.blitz}`);
  });
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nTotal time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
}

analyzeAllPlayers().catch(console.error);