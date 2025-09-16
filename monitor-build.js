const fs = require('fs');
const path = require('path');

const PRODUCTION_DB = path.join(__dirname, 'chess-production.db');
const CHECKPOINT_FILE = path.join(__dirname, 'production-checkpoint.json');

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getETA(processed, total, startTime) {
  if (processed === 0) return 'Calculating...';
  const elapsed = Date.now() - startTime;
  const rate = processed / elapsed; // items per ms
  const remaining = total - processed;
  const etaMs = remaining / rate;
  const etaMinutes = Math.round(etaMs / 1000 / 60);
  return `${etaMinutes} minutes`;
}

function monitorBuild() {
  console.clear();
  console.log('📊 PRODUCTION DATABASE BUILD MONITOR');
  console.log('='.repeat(60));
  
  // Check if database file exists and get size
  if (fs.existsSync(PRODUCTION_DB)) {
    const stats = fs.statSync(PRODUCTION_DB);
    console.log(`💾 Database Size: ${formatBytes(stats.size)}`);
    console.log(`📅 Last Modified: ${stats.mtime.toLocaleTimeString()}`);
  } else {
    console.log('💾 Database: Not created yet');
  }
  
  // Check checkpoint progress
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      console.log('='.repeat(60));
      console.log('📌 PROGRESS STATUS:');
      console.log(`   👥 Players: File ${checkpoint.players.fileIndex}/212 (${((checkpoint.players.fileIndex/212)*100).toFixed(1)}%)`);
      console.log(`      Processed: ${checkpoint.players.processed.toLocaleString()}`);
      console.log(`   🏆 Tournaments: File ${checkpoint.tournaments.fileIndex}/212 (${((checkpoint.tournaments.fileIndex/212)*100).toFixed(1)}%)`);
      console.log(`      Processed: ${checkpoint.tournaments.processed.toLocaleString()}`);
      console.log(`   ♟️  Games: File ${checkpoint.games.fileIndex}/50 (${((checkpoint.games.fileIndex/50)*100).toFixed(1)}%)`);
      console.log(`      Processed: ${checkpoint.games.processed.toLocaleString()}`);
      console.log(`   🔍 Indexes: ${checkpoint.indexesCreated ? '✅ Complete' : '⏳ Pending'}`);
    } catch (error) {
      console.log('❌ Error reading checkpoint:', error.message);
    }
  } else {
    console.log('📌 No checkpoint file found - build may not have started');
  }
  
  console.log('='.repeat(60));
  console.log('⏱️  Auto-refresh in 10 seconds... (Ctrl+C to stop)');
  
  // Schedule next update
  setTimeout(monitorBuild, 10000);
}

// Start monitoring
console.log('🚀 Starting database build monitor...\n');
console.log('This will refresh every 10 seconds with current progress');
console.log('Press Ctrl+C to exit monitor\n');

monitorBuild();