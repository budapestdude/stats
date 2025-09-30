const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function estimateGamesInFile(filePath) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { 
      encoding: 'utf8',
      highWaterMark: 64 * 1024 // 64KB chunks
    });
    
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });
    
    let gameCount = 0;
    let lineCount = 0;
    
    rl.on('line', (line) => {
      lineCount++;
      if (line.startsWith('[Event ')) {
        gameCount++;
      }
      
      // Sample first 10000 lines for estimation
      if (lineCount >= 10000) {
        rl.close();
        rl.removeAllListeners();
        
        // Estimate based on file size
        const fileSize = fs.statSync(filePath).size;
        const bytesRead = stream.bytesRead;
        const estimatedGames = Math.round((gameCount / bytesRead) * fileSize);
        
        resolve({
          fileName: path.basename(filePath),
          fileSize: fileSize,
          sampledGames: gameCount,
          estimatedGames: estimatedGames
        });
      }
    });
    
    rl.on('close', () => {
      // If file is small enough to read completely
      resolve({
        fileName: path.basename(filePath),
        fileSize: fs.statSync(filePath).size,
        sampledGames: gameCount,
        estimatedGames: gameCount
      });
    });
  });
}

async function estimateAllGames() {
  const pgnDir = path.join(__dirname, 'pgn-files');
  const files = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .map(f => path.join(pgnDir, f))
    .sort();
  
  console.log('🔍 Estimating games in PGN files...');
  console.log('=' .repeat(60));
  
  let totalEstimated = 0;
  let totalSize = 0;
  
  for (const file of files) {
    const estimate = await estimateGamesInFile(file);
    console.log(`📁 ${estimate.fileName}`);
    console.log(`   Size: ${(estimate.fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Estimated games: ${estimate.estimatedGames.toLocaleString()}`);
    
    totalEstimated += estimate.estimatedGames;
    totalSize += estimate.fileSize;
  }
  
  console.log('=' .repeat(60));
  console.log(`📊 Total Estimates:`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Estimated total games: ${totalEstimated.toLocaleString()}`);
  console.log(`   Average game size: ${Math.round(totalSize / totalEstimated)} bytes`);
  
  // Estimate import time
  const gamesPerSecond = 5000; // Conservative estimate
  const estimatedSeconds = totalEstimated / gamesPerSecond;
  const hours = Math.floor(estimatedSeconds / 3600);
  const minutes = Math.floor((estimatedSeconds % 3600) / 60);
  
  console.log(`\n⏱️  Estimated import time: ${hours}h ${minutes}m (at ${gamesPerSecond} games/sec)`);
  
  // Database size estimate
  const bytesPerGame = 500; // Approximate with indexes
  const estimatedDbSize = (totalEstimated * bytesPerGame) / 1024 / 1024 / 1024;
  console.log(`💾 Estimated database size: ${estimatedDbSize.toFixed(2)} GB`);
}

if (require.main === module) {
  estimateAllGames().catch(console.error);
}

module.exports = { estimateGamesInFile, estimateAllGames };