const fs = require('fs');
const path = require('path');
const { PlayerAnalyzer } = require('./player-analyzer');

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

async function analyzeTopPlayers() {
  const pgnDir = path.join(__dirname, 'pgn-files');
  const processedDir = path.join(__dirname, 'processed');
  
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const pgnFiles = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .sort();
  
  console.log(`Found ${pgnFiles.length} PGN files to analyze`);
  
  for (const playerName of topPlayers) {
    console.log(`\n=== Analyzing ${playerName} ===`);
    const analyzer = new PlayerAnalyzer(playerName);
    
    for (const file of pgnFiles) {
      const filePath = path.join(pgnDir, file);
      const year = file.match(/\d{4}/)?.[0] || 'unknown';
      
      process.stdout.write(`Processing ${file}...`);
      const gamesFound = await analyzer.analyzeFile(filePath);
      
      if (gamesFound > 0) {
        console.log(` found ${gamesFound} games`);
      } else {
        process.stdout.write(' no games found\r');
      }
    }
    
    const stats = analyzer.getStats();
    console.log(`Total games for ${playerName}: ${stats.overview.totalGames}`);
    
    if (stats.overview.totalGames > 0) {
      const outputPath = path.join(processedDir, `${playerName.toLowerCase().replace(/\s+/g, '-')}-stats.json`);
      fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
      console.log(`Stats saved to ${outputPath}`);
    }
  }
  
  console.log('\n=== Analysis Complete ===');
}

analyzeTopPlayers().catch(console.error);