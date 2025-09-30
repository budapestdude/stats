const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// List of files to process (excluding the one we already processed)
const filesToProcess = [
  'LumbrasGigaBase_OTB_2015-2019.pgn',
  'LumbrasGigaBase_OTB_2010-2014.pgn', 
  'LumbrasGigaBase_OTB_2005-2009.pgn',
  'LumbrasGigaBase_OTB_2000-2004.pgn',
  'LumbrasGigaBase_OTB_1990-1999.pgn',
  'LumbrasGigaBase_OTB_1970-1989.pgn',
  'lumbrasgigabase_2025.pgn',
  'world_champions.pgn',
  'classic_games.pgn'
];

async function processFile(fileName) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting processing of: ${fileName}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const child = spawn('node', ['process-single-file.js', fileName], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully processed ${fileName}`);
        resolve();
      } else {
        console.error(`❌ Failed to process ${fileName} with exit code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      console.error(`❌ Error processing ${fileName}:`, err);
      reject(err);
    });
  });
}

async function processAllFiles() {
  console.log('='.repeat(80));
  console.log('BATCH PROCESSING ALL PGN FILES');
  console.log('='.repeat(80));
  console.log(`Will process ${filesToProcess.length} files sequentially\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const fileName of filesToProcess) {
    const filePath = path.join(__dirname, 'pgn-files', fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${fileName} - file not found`);
      failCount++;
      continue;
    }
    
    const stats = fs.statSync(filePath);
    const sizeMB = Math.round(stats.size / (1024 * 1024));
    console.log(`\nFile: ${fileName} (${sizeMB} MB)`);
    
    try {
      await processFile(fileName);
      successCount++;
    } catch (error) {
      console.error(`Failed to process ${fileName}:`, error.message);
      failCount++;
      // Continue with next file even if one fails
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('BATCH PROCESSING COMPLETE');
  console.log('='.repeat(80));
  console.log(`✅ Successfully processed: ${successCount} files`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} files`);
  }
  
  // Show final database statistics
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database('./chess-stats.db');
  
  db.get('SELECT COUNT(*) as count, SUM(games_count) as total_games FROM tournament_data', (err, row) => {
    if (!err && row) {
      console.log(`\nFinal database statistics:`);
      console.log(`  Total tournaments: ${row.count}`);
      console.log(`  Total games: ${row.total_games}`);
    }
    db.close();
  });
}

// Run the batch processor
processAllFiles().catch(console.error);