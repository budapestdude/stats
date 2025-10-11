// Split large database into chunks for GitHub Release
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const CHUNK_SIZE = 1.8 * 1024 * 1024 * 1024; // 1.8GB chunks (under 2GB limit)
const OUTPUT_DIR = path.join(__dirname, 'database-chunks');

console.log('📦 Splitting database into chunks for GitHub Release\n');

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database not found:', DB_PATH);
  process.exit(1);
}

const stats = fs.statSync(DB_PATH);
const fileSize = stats.size;
const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

console.log(`Database size: ${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Chunk size: ${(CHUNK_SIZE / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Total chunks: ${totalChunks}\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Split file
const readStream = fs.createReadStream(DB_PATH, { highWaterMark: 64 * 1024 * 1024 }); // 64MB buffer
let chunkIndex = 1;
let bytesWritten = 0;
let currentChunk = null;

readStream.on('data', (chunk) => {
  if (!currentChunk || bytesWritten >= CHUNK_SIZE) {
    // Close previous chunk
    if (currentChunk) {
      currentChunk.end();
      console.log(`✓ Chunk ${chunkIndex - 1} complete: ${(bytesWritten / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    // Start new chunk
    const chunkPath = path.join(OUTPUT_DIR, `complete-tournaments.db.part${chunkIndex}`);
    currentChunk = fs.createWriteStream(chunkPath);
    chunkIndex++;
    bytesWritten = 0;
  }

  currentChunk.write(chunk);
  bytesWritten += chunk.length;

  // Progress indicator
  const progress = ((readStream.bytesRead / fileSize) * 100).toFixed(1);
  process.stdout.write(`\rProgress: ${progress}% (chunk ${chunkIndex - 1}/${totalChunks})`);
});

readStream.on('end', () => {
  if (currentChunk) {
    currentChunk.end();
    console.log(`\n✓ Chunk ${chunkIndex - 1} complete: ${(bytesWritten / 1024 / 1024 / 1024).toFixed(2)} GB`);
  }

  console.log('\n✅ Split complete!');
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Create GitHub Release with tag "database-v2"');
  console.log('2. Upload all .part* files to the release');
  console.log('3. Update DATABASE_DOWNLOAD_URL environment variable');
  console.log('4. Deploy with new download script');
});

readStream.on('error', (err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
