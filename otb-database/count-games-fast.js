const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function countGamesInFile(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    let processedBytes = 0;
    const fileSize = fs.statSync(filePath).size;
    let lastProgress = 0;
    
    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      highWaterMark: 1024 * 1024 // 1MB chunks for faster reading
    });
    
    stream.on('data', (chunk) => {
      // Count [Event markers which indicate new games
      const matches = chunk.match(/\[Event "/g);
      if (matches) {
        count += matches.length;
      }
      
      processedBytes += chunk.length;
      const progress = Math.floor((processedBytes / fileSize) * 100);
      
      // Show progress every 10%
      if (progress >= lastProgress + 10) {
        process.stdout.write(`\r   Scanning: ${progress}%`);
        lastProgress = progress;
      }
    });
    
    stream.on('end', () => {
      process.stdout.write('\r   Scanning: 100%\n');
      resolve({
        fileName: path.basename(filePath),
        fileSize: fileSize,
        gameCount: count
      });
    });
    
    stream.on('error', reject);
  });
}

async function countAllGames() {
  const pgnDir = path.join(__dirname, 'pgn-files');
  const files = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .map(f => path.join(pgnDir, f))
    .sort();
  
  console.log('📊 Counting games in PGN files (this may take a few minutes)...');
  console.log('=' .repeat(60));
  
  let totalGames = 0;
  let totalSize = 0;
  const results = [];
  
  for (const file of files) {
    console.log(`\n📁 ${path.basename(file)}`);
    console.log(`   Size: ${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
    
    const result = await countGamesInFile(file);
    console.log(`   Games found: ${result.gameCount.toLocaleString()}`);
    
    results.push(result);
    totalGames += result.gameCount;
    totalSize += result.fileSize;
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`📊 Final Count:`);
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`   🎯 Total games: ${totalGames.toLocaleString()}`);
  
  if (totalGames > 0) {
    console.log(`   Average game size: ${Math.round(totalSize / totalGames).toLocaleString()} bytes`);
    
    // Estimate import time
    const gamesPerSecond = 3000; // Conservative estimate with indexes
    const estimatedSeconds = totalGames / gamesPerSecond;
    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    
    console.log(`\n⏱️  Estimated import time: ${hours}h ${minutes}m (at ${gamesPerSecond} games/sec)`);
    
    // Database size estimate
    const bytesPerGame = 800; // With indexes and metadata
    const estimatedDbSize = (totalGames * bytesPerGame) / 1024 / 1024 / 1024;
    console.log(`💾 Estimated database size: ${estimatedDbSize.toFixed(2)} GB`);
    
    // RAM requirements
    const ramRequired = Math.max(1, Math.ceil(estimatedDbSize * 0.25));
    console.log(`🧠 Recommended RAM for optimal performance: ${ramRequired} GB`);
  }
  
  // Save results
  const resultsFile = path.join(__dirname, 'game-count-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalGames: totalGames,
    totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
    files: results
  }, null, 2));
  
  console.log(`\n✅ Results saved to: ${resultsFile}`);
}

if (require.main === module) {
  countAllGames().catch(console.error);
}

module.exports = { countGamesInFile, countAllGames };