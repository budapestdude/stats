const fs = require('fs');
const path = require('path');

/**
 * Split the updated database with PGN moves into 3 chunks for GitHub Release
 */

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const chunkSize = 2 * 1024 * 1024 * 1024; // 2GB chunks

console.log('🔪 Splitting updated database into chunks...\n');

// Get file size
const stats = fs.statSync(dbPath);
const fileSize = stats.size;
const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2);

console.log(`Database: ${dbPath}`);
console.log(`Total size: ${fileSizeGB} GB (${fileSize.toLocaleString()} bytes)\n`);

// Calculate number of chunks
const numChunks = Math.ceil(fileSize / chunkSize);
console.log(`Will create ${numChunks} chunks of ~2GB each\n`);

// Open input file
const inputStream = fs.createReadStream(dbPath, { highWaterMark: 64 * 1024 }); // 64KB buffer

let chunkIndex = 1;
let bytesWritten = 0;
let totalBytesRead = 0;
let currentChunk = null;

function createNewChunk() {
  if (currentChunk) {
    currentChunk.end();
  }

  const chunkPath = path.join(__dirname, `complete-tournaments.db.part${chunkIndex}`);
  console.log(`Creating chunk ${chunkIndex}: ${chunkPath}`);
  currentChunk = fs.createWriteStream(chunkPath);
  chunkIndex++;
  bytesWritten = 0;
}

createNewChunk();

inputStream.on('data', (chunk) => {
  const remainingInChunk = chunkSize - bytesWritten;

  if (chunk.length <= remainingInChunk) {
    // Entire chunk fits in current file
    currentChunk.write(chunk);
    bytesWritten += chunk.length;
    totalBytesRead += chunk.length;
  } else {
    // Need to split across files
    const firstPart = chunk.slice(0, remainingInChunk);
    const secondPart = chunk.slice(remainingInChunk);

    currentChunk.write(firstPart);
    totalBytesRead += firstPart.length;

    const chunkSizeGB = (chunkSize / 1024 / 1024 / 1024).toFixed(2);
    console.log(`  ✅ Completed ${chunkIndex - 1} (${chunkSizeGB} GB)`);

    createNewChunk();
    currentChunk.write(secondPart);
    bytesWritten += secondPart.length;
    totalBytesRead += secondPart.length;
  }

  // Progress update
  const progress = ((totalBytesRead / fileSize) * 100).toFixed(1);
  process.stdout.write(`\r  Progress: ${progress}%`);
});

inputStream.on('end', () => {
  if (currentChunk) {
    currentChunk.end();
    const finalSizeGB = (bytesWritten / 1024 / 1024 / 1024).toFixed(2);
    console.log(`\n  ✅ Completed ${chunkIndex - 1} (${finalSizeGB} GB)`);
  }

  console.log('\n✅ Database split complete!\n');
  console.log('Chunk files created:');
  for (let i = 1; i < chunkIndex; i++) {
    const chunkPath = path.join(__dirname, `complete-tournaments.db.part${i}`);
    const chunkStats = fs.statSync(chunkPath);
    const chunkGB = (chunkStats.size / 1024 / 1024 / 1024).toFixed(2);
    console.log(`  - complete-tournaments.db.part${i} (${chunkGB} GB)`);
  }

  console.log('\n📦 Next steps:');
  console.log('1. Create GitHub Release: database-v3');
  console.log('2. Upload all chunk files to the release');
  console.log('3. Update download-full-db.js to use database-v3');
  console.log('4. Push to Railway');
});

inputStream.on('error', (err) => {
  console.error('\n❌ Error reading database:', err);
  process.exit(1);
});
