const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function monitorProgress() {
  const tempDir = path.join(__dirname, 'indexes', 'temp');
  const indexDir = path.join(__dirname, 'indexes');
  
  console.clear();
  console.log('Indexing Progress Monitor');
  console.log('='.repeat(60));
  
  // Check temp directory for batch files
  if (fs.existsSync(tempDir)) {
    const tempFiles = fs.readdirSync(tempDir);
    
    // Count batches
    const batches = {};
    let totalSize = 0;
    
    tempFiles.forEach(file => {
      const stats = fs.statSync(path.join(tempDir, file));
      totalSize += stats.size;
      
      const match = file.match(/(\w+)-batch-(\d+)\.json/);
      if (match) {
        const [, type, batchNum] = match;
        if (!batches[type]) batches[type] = 0;
        batches[type] = Math.max(batches[type], parseInt(batchNum));
      }
    });
    
    console.log('\nBatch Files:');
    console.log('-'.repeat(40));
    Object.entries(batches).forEach(([type, count]) => {
      console.log(`  ${type.padEnd(15)}: ${count} batches`);
    });
    
    const estimatedGames = (batches.gameIds || 0) * 50000;
    console.log(`\nEstimated games processed: ~${estimatedGames.toLocaleString()}`);
    console.log(`Temp directory size: ${formatBytes(totalSize)}`);
  }
  
  // Check for completed indexes
  const indexes = ['players', 'events', 'years', 'openings', 'timeControls', 'gameIds'];
  const completedIndexes = [];
  
  indexes.forEach(index => {
    const indexFile = path.join(indexDir, `${index}.json`);
    if (fs.existsSync(indexFile)) {
      const stats = fs.statSync(indexFile);
      completedIndexes.push({
        name: index,
        size: formatBytes(stats.size),
        modified: stats.mtime
      });
    }
  });
  
  if (completedIndexes.length > 0) {
    console.log('\nCompleted Indexes:');
    console.log('-'.repeat(40));
    completedIndexes.forEach(idx => {
      console.log(`  ${idx.name.padEnd(15)}: ${idx.size.padStart(10)} (${idx.modified.toLocaleTimeString()})`);
    });
  }
  
  // Check for stats file
  const statsFile = path.join(indexDir, 'index-stats.json');
  if (fs.existsSync(statsFile)) {
    const stats = JSON.parse(fs.readFileSync(statsFile));
    console.log('\n' + '='.repeat(60));
    console.log('INDEXING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total games: ${stats.totalGames?.toLocaleString()}`);
    console.log(`Total players: ${stats.totalPlayers?.toLocaleString()}`);
    console.log(`Total events: ${stats.totalEvents?.toLocaleString()}`);
    console.log(`Date range: ${stats.dateRange?.earliest} to ${stats.dateRange?.latest}`);
    console.log(`Indexing time: ${stats.indexingTime}`);
    return true; // Indexing complete
  }
  
  return false; // Still in progress
}

// Monitor every 5 seconds
const interval = setInterval(() => {
  const isComplete = monitorProgress();
  if (isComplete) {
    clearInterval(interval);
    console.log('\nMonitoring complete!');
  }
}, 5000);

// Initial check
monitorProgress();

console.log('\n\nPress Ctrl+C to stop monitoring...');