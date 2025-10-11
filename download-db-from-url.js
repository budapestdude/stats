// Download database from URL to Railway Volume
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DOWNLOAD_URL = process.env.DATABASE_DOWNLOAD_URL;
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
const DB_PATH = path.join(VOLUME_PATH, 'railway-subset.db');

console.log('🔍 Checking for database...\n');

// Check if force redownload is enabled
if (process.env.FORCE_REDOWNLOAD === 'true' && fs.existsSync(DB_PATH)) {
  console.log('⚠️  FORCE_REDOWNLOAD enabled - deleting existing database');
  fs.unlinkSync(DB_PATH);
}

// Check if database already exists in volume
if (fs.existsSync(DB_PATH)) {
  const stats = fs.statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Database already exists (${sizeMB} MB)`);
  console.log('   Skipping download.\n');
  process.exit(0);
}

if (!DOWNLOAD_URL) {
  console.log('⚠️  DATABASE_DOWNLOAD_URL not set');
  console.log('   Server will use fallback database.\n');
  process.exit(0);
}

console.log('📥 Downloading database from GitHub Release...');
console.log(`   URL: ${DOWNLOAD_URL}\n`);

// Create volume directory if needed
if (!fs.existsSync(VOLUME_PATH)) {
  fs.mkdirSync(VOLUME_PATH, { recursive: true });
}

let downloaded = 0;
const startTime = Date.now();

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

      const totalSize = parseInt(response.headers['content-length'], 10);
      const totalSizeMB = formatBytes(totalSize);

      console.log(`   Total size: ${totalSizeMB}`);
      console.log('   Downloading...\n');

      const writeStream = fs.createWriteStream(DB_PATH);
      let lastUpdate = Date.now();

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

      response.pipe(writeStream);

      writeStream.on('finish', () => {
        writeStream.close();

        // Set file permissions to readable
        try {
          fs.chmodSync(DB_PATH, 0o644);
          console.log('\n\n✅ Download complete!');
          console.log(`   Size: ${formatBytes(downloaded)}`);
          console.log(`   Time: ${formatTime(Date.now() - startTime)}`);
          console.log(`   Location: ${DB_PATH}`);
          console.log(`   Permissions: 644 (readable)\n`);
        } catch (err) {
          console.warn('   Warning: Could not set permissions:', err.message);
        }

        resolve();
      });

      writeStream.on('error', (err) => {
        fs.unlinkSync(DB_PATH);
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

downloadFile(DOWNLOAD_URL)
  .then(() => {
    console.log('🎉 Database ready!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Download failed:', err.message);
    console.error('   Server will use fallback database.\n');

    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    process.exit(0);
  });
