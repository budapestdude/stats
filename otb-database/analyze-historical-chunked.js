const HistoricalChessAnalyzer = require('./historical-analyzer');
const fs = require('fs');
const path = require('path');

async function analyzeInChunks() {
  console.log('Starting chunked historical chess database analysis...');
  console.log('=' .repeat(60));
  
  const analyzer = new HistoricalChessAnalyzer();
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  const files = fs.readdirSync(pgnDir);
  const pgnFiles = files.filter(f => f.endsWith('.pgn') || f.endsWith('.PGN'));
  
  console.log(`Found ${pgnFiles.length} PGN databases to analyze`);
  console.log('Processing databases one at a time to avoid memory issues...\n');
  
  // Process each database individually
  for (const file of pgnFiles) {
    const filePath = path.join(pgnDir, file);
    console.log(`\nProcessing: ${file}`);
    console.log('-'.repeat(40));
    
    try {
      await analyzer.analyzeDatabase(filePath);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Small delay to let memory settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
      console.log('Continuing with next database...');
    }
  }
  
  console.log('\nCalculating final statistics...');
  analyzer.calculateDerivedStats();
  const stats = analyzer.getFormattedStats();
  
  // Save results to JSON
  const outputPath = path.join(__dirname, 'processed', 'historical-analysis.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log('=' .repeat(60));
  console.log(`Total games analyzed: ${stats.overview.totalGames.toLocaleString()}`);
  console.log(`Date range: ${stats.overview.dateRange.earliest || 'Unknown'} - ${stats.overview.dateRange.latest || 'Unknown'}`);
  console.log(`Number of databases: ${stats.overview.databases.length}`);
  
  console.log('\nDatabases analyzed:');
  stats.overview.databases.forEach(db => {
    console.log(`  - ${db.name}: ${db.games.toLocaleString()} games`);
    if (db.dateRange.earliest && db.dateRange.latest) {
      console.log(`    Date range: ${db.dateRange.earliest}-${db.dateRange.latest}`);
    }
    if (db.avgElo > 0) {
      console.log(`    Average ELO: ${db.avgElo}`);
    }
  });
  
  console.log('\nData Quality:');
  console.log(`  Games with ELO ratings: ${stats.overview.dataQuality.gamesWithElo.toLocaleString()}`);
  console.log(`  Games with dates: ${stats.overview.dataQuality.gamesWithDate.toLocaleString()}`);
  console.log(`  Games with openings: ${stats.overview.dataQuality.gamesWithOpening.toLocaleString()}`);
  console.log(`  Complete games: ${stats.overview.dataQuality.completeGames.toLocaleString()}`);
  console.log(`  Completeness rate: ${stats.overview.dataQuality.completenessRate}`);
  
  console.log('\nGames by Decade:');
  Object.keys(stats.decades).forEach(decade => {
    const d = stats.decades[decade];
    if (d.games > 0) {
      console.log(`  ${decade}: ${d.games.toLocaleString()} games`);
      console.log(`    White wins: ${d.whiteWinRate}%, Draws: ${d.drawRate}%, Black wins: ${d.blackWinRate}%`);
      if (d.avgElo > 0) {
        console.log(`    Average ELO: ${d.avgElo}`);
      }
    }
  });
  
  console.log('\nEngine Era Analysis:');
  console.log(`  Pre-2000 (Pre-Engine): ${stats.engineEra.preEngine.games.toLocaleString()} games, ${stats.engineEra.preEngine.drawRate}% draws`);
  console.log(`  2000-2010 (Early Engine): ${stats.engineEra.earlyEngine.games.toLocaleString()} games, ${stats.engineEra.earlyEngine.drawRate}% draws`);
  console.log(`  2010+ (Modern Engine): ${stats.engineEra.modernEngine.games.toLocaleString()} games, ${stats.engineEra.modernEngine.drawRate}% draws`);
  
  if (stats.insights && stats.insights.length > 0) {
    console.log('\nKey Insights:');
    stats.insights.forEach(insight => {
      console.log(`  [${insight.category}] ${insight.finding}`);
    });
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`Results saved to: ${outputPath}`);
  console.log('View the dashboard at: http://localhost:3000/historical');
  console.log('=' .repeat(60));
}

// Run with increased memory limit
analyzeInChunks().catch(error => {
  console.error('Fatal error during analysis:', error);
  process.exit(1);
});