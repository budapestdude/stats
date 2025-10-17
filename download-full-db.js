// Download and reassemble multi-chunk database from GitHub Release
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration
const BASE_URL = process.env.DATABASE_DOWNLOAD_URL || 'https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db';
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
const FALLBACK_PATH = path.join(__dirname, 'otb-database');
const CHUNK_COUNT = parseInt(process.env.DATABASE_CHUNK_COUNT || '3', 10); // Number of chunks

// Try to determine writable database path
function getWritableDatabasePath() {
  // Try Railway volume first
  const volumePath = path.join(VOLUME_PATH, 'complete-tournaments.db');
  try {
    // Test if we can write to the volume
    const testFile = path.join(VOLUME_PATH, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Railway volume is writable, using:', volumePath);
    return volumePath;
  } catch (err) {
    // Volume not writable, use fallback
    console.warn('⚠️  Railway volume not writable:', err.message);
    console.log('   Using fallback path:', path.join(FALLBACK_PATH, 'complete-tournaments.db'));

    // Ensure fallback directory exists
    if (!fs.existsSync(FALLBACK_PATH)) {
      fs.mkdirSync(FALLBACK_PATH, { recursive: true });
    }

    return path.join(FALLBACK_PATH, 'complete-tournaments.db');
  }
}

const DB_PATH = getWritableDatabasePath();

console.log('🔍 Checking for database...\n');

// Check if force redownload is enabled
if (process.env.FORCE_REDOWNLOAD === 'true' && fs.existsSync(DB_PATH)) {
  console.log('⚠️  FORCE_REDOWNLOAD enabled - deleting existing database');
  try {
    // Try to change permissions first if we can't delete
    try {
      fs.chmodSync(DB_PATH, 0o666);
    } catch (chmodErr) {
      // Ignore chmod errors, try deletion anyway
    }
    fs.unlinkSync(DB_PATH);
    console.log('   ✅ Existing database deleted');
  } catch (err) {
    console.warn(`   ⚠️  Could not delete existing database: ${err.message}`);
    console.warn('   Continuing anyway - may cause issues if file is corrupted');
  }
}

// Check if database already exists in volume
if (fs.existsSync(DB_PATH)) {
  const stats = fs.statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Database already exists (${sizeMB} MB)`);

  // Ensure correct permissions for the database file
  console.log('   Checking file permissions...');
  try {
    // Set read/write for owner and group, read for others (0o664)
    fs.chmodSync(DB_PATH, 0o664);
    console.log('   ✅ Permissions set to 664 (rw-rw-r--)');
  } catch (err) {
    console.warn(`   ⚠️  Could not set permissions: ${err.message}`);
    console.warn('   The database might not be readable by the application');
  }

  console.log('   Skipping download.\n');
  process.exit(0);
}

if (!BASE_URL) {
  console.log('⚠️  DATABASE_DOWNLOAD_URL not set');
  console.log('   Server will use fallback database.\n');
  process.exit(0);
}

console.log(`📥 Downloading ${CHUNK_COUNT}-part database from GitHub Release...`);
console.log(`   Base URL: ${BASE_URL}\n`);

// Create volume directory if needed
if (!fs.existsSync(VOLUME_PATH)) {
  fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(url, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`   Following redirect (${response.statusCode})...`);
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
      }

      resolve(response);
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function downloadChunk(chunkNum, outputPath) {
  const chunkUrl = `${BASE_URL}.part${chunkNum}`;
  console.log(`\n📦 Downloading chunk ${chunkNum}/${CHUNK_COUNT}...`);
  console.log(`   URL: ${chunkUrl}`);

  const startTime = Date.now();
  let downloaded = 0;
  let lastUpdate = Date.now();

  const response = await downloadFile(chunkUrl);
  const totalSize = parseInt(response.headers['content-length'], 10);
  const totalSizeMB = formatBytes(totalSize);

  console.log(`   Size: ${totalSizeMB}`);

  const writeStream = fs.createWriteStream(outputPath);

  response.on('data', (chunk) => {
    downloaded += chunk.length;

    const now = Date.now();
    if (now - lastUpdate > 2000) {
      const percent = ((downloaded / totalSize) * 100).toFixed(1);
      const downloadedMB = formatBytes(downloaded);
      const elapsed = formatTime(now - startTime);
      const speed = (downloaded / 1024 / 1024 / ((now - startTime) / 1000)).toFixed(2);

      process.stdout.write(`   Progress: ${percent}% (${downloadedMB} / ${totalSizeMB}) - ${speed} MB/s - ${elapsed} elapsed\r`);
      lastUpdate = now;
    }
  });

  return new Promise((resolve, reject) => {
    response.pipe(writeStream);

    writeStream.on('finish', () => {
      writeStream.close();
      console.log(`\n   ✅ Chunk ${chunkNum} complete (${formatBytes(downloaded)})`);
      resolve();
    });

    writeStream.on('error', (err) => {
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkErr) {
        // Ignore unlink errors during cleanup
      }
      reject(err);
    });
  });
}

async function assembleDatabase(tempDir) {
  console.log('\n🔧 Assembling database from chunks...');

  const writeStream = fs.createWriteStream(DB_PATH);

  for (let i = 1; i <= CHUNK_COUNT; i++) {
    const chunkPath = path.join(tempDir, `chunk${i}`);
    console.log(`   Merging chunk ${i}/${CHUNK_COUNT}...`);

    const readStream = fs.createReadStream(chunkPath);
    await new Promise((resolve, reject) => {
      readStream.pipe(writeStream, { end: i === CHUNK_COUNT });
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });

    // Delete chunk after merging
    try {
      fs.unlinkSync(chunkPath);
    } catch (err) {
      console.warn(`   Warning: Could not delete chunk ${i}: ${err.message}`);
    }
  }

  // Clean up temp directory
  fs.rmdirSync(tempDir);

  console.log('   ✅ Assembly complete!');
}

async function main() {
  const overallStart = Date.now();
  // Use /app/tmp for temporary chunks to avoid Railway volume permission issues
  // Final database will still be written to VOLUME_PATH
  const tempDir = path.join(__dirname, 'tmp', 'temp-chunks');

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`   Created temp directory: ${tempDir}`);
    }

    // Download all chunks
    for (let i = 1; i <= CHUNK_COUNT; i++) {
      const chunkPath = path.join(tempDir, `chunk${i}`);
      await downloadChunk(i, chunkPath);
    }

    // Assemble chunks
    await assembleDatabase(tempDir);

    // Set permissions
    try {
      fs.chmodSync(DB_PATH, 0o644);
    } catch (err) {
      console.warn('   Warning: Could not set permissions:', err.message);
    }

    const stats = fs.statSync(DB_PATH);
    const totalTime = formatTime(Date.now() - overallStart);

    console.log('\n🎉 Database ready!');
    console.log(`   Final size: ${formatBytes(stats.size)}`);
    console.log(`   Total time: ${totalTime}`);
    console.log(`   Location: ${DB_PATH}\n`);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Download failed:', err.message);
    console.error('   Server will use fallback database.\n');

    // Clean up on failure
    if (fs.existsSync(DB_PATH)) {
      try {
        fs.unlinkSync(DB_PATH);
      } catch (unlinkErr) {
        console.warn('   Warning: Could not delete partial database file');
      }
    }
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn('   Warning: Could not delete temp directory');
      }
    }

    process.exit(0); // Don't fail deployment
  }
}

main();
