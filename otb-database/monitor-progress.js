const fs = require('fs');
const path = require('path');

function checkProgress() {
  const tempDir = path.join(__dirname, 'indexes', 'temp');
  
  // Count batch files by type
  const files = fs.readdirSync(tempDir);
  const counts = {
    players: 0,
    events: 0,
    openings: 0,
    timeControls: 0,
    gameIds: 0
  };
  
  let maxBatch = 0;
  
  files.forEach(file => {
    const match = file.match(/(\w+)-batch-(\d+)\.json/);
    if (match) {
      const type = match[1];
      const batchNum = parseInt(match[2]);
      
      if (counts.hasOwnProperty(type)) {
        counts[type]++;
      }
      
      if (batchNum > maxBatch) {
        maxBatch = batchNum;
      }
    }
  });
  
  const estimatedGames = maxBatch * 50000;
  
  console.clear();
  console.log('=== Indexing Progress Monitor ===');
  console.log(`Time: ${new Date().toLocaleTimeString()}`);
  console.log(`\nHighest Batch Number: ${maxBatch}`);
  console.log(`Estimated Games Processed: ${estimatedGames.toLocaleString()}`);
  console.log(`\nBatch Files Created:`);
  console.log(`  Players:      ${counts.players}`);
  console.log(`  Events:       ${counts.events}`);
  console.log(`  Openings:     ${counts.openings}`);
  console.log(`  Time Controls: ${counts.timeControls}`);
  console.log(`  Game IDs:     ${counts.gameIds}`);
  
  const totalFiles = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nTotal Files: ${totalFiles}`);
  
  // Check if still processing
  const expectedFiles = maxBatch * 5; // 5 types of indexes
  if (totalFiles < expectedFiles) {
    console.log(`\nStatus: Processing batch ${maxBatch + 1}...`);
  } else {
    console.log(`\nStatus: Batch ${maxBatch} complete`);
  }
  
  // Estimate completion
  const targetGames = 9300000; // ~9.3 million total games
  const progress = (estimatedGames / targetGames * 100).toFixed(1);
  console.log(`\nProgress: ${progress}% complete`);
  
  // Progress bar
  const barLength = 40;
  const filled = Math.round(barLength * estimatedGames / targetGames);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  console.log(`[${bar}]`);
  
  if (estimatedGames < targetGames) {
    console.log('\nPress Ctrl+C to stop monitoring');
  } else {
    console.log('\n✓ Indexing appears to be complete!');
    console.log('Next step: Run merge-indexes.js to create final indexes');
  }
}

// Check every 5 seconds
checkProgress();
setInterval(checkProgress, 5000);