const fs = require('fs');
const path = require('path');

function checkProgress() {
  console.log('\n📊 Checking Historical Analysis Progress...\n');
  
  // Check if analysis is complete
  const resultsPath = path.join(__dirname, 'processed', 'historical-analysis.json');
  if (fs.existsSync(resultsPath)) {
    const stats = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    console.log('✅ ANALYSIS COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`Total games analyzed: ${stats.overview.totalGames.toLocaleString()}`);
    console.log(`Date range: ${stats.overview.dateRange.earliest} - ${stats.overview.dateRange.latest}`);
    console.log(`Databases processed: ${stats.overview.databases.length}`);
    console.log('\nDatabase breakdown:');
    stats.overview.databases.forEach(db => {
      console.log(`  - ${db.name}: ${db.games.toLocaleString()} games`);
    });
    console.log('=' .repeat(60));
    console.log('\nYou can now view the results at: http://localhost:3000/historical');
  } else {
    console.log('⏳ Analysis still in progress...');
    console.log('This process analyzes millions of games and may take 5-10 minutes.');
    console.log('Check the analyze-historical.js output for detailed progress.');
  }
}

checkProgress();