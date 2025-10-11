// Download database from Google Drive on Railway startup
const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const GOOGLE_DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID; // Set in Railway env vars

console.log('🔍 Checking for database...\n');

// Check if database already exists
if (fs.existsSync(DB_PATH)) {
  const stats = fs.statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Database already exists (${sizeMB} MB)`);
  console.log('   Skipping download.\n');
  process.exit(0);
}

// Check if Google Drive file ID is set
if (!GOOGLE_DRIVE_FILE_ID) {
  console.log('⚠️  GOOGLE_DRIVE_FILE_ID not set');
  console.log('   Using fallback database if available.\n');
  process.exit(0);
}

console.log('📥 Downloading database from Google Drive...');
console.log(`   File ID: ${GOOGLE_DRIVE_FILE_ID}\n`);

// Google Drive direct download URL with confirmation bypass for large files
const downloadUrl = `https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_FILE_ID}&confirm=t`;

// Create otb-database directory if it doesn't exist
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Download file
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
    https.get(url, (response) => {
      // Handle redirects (Google Drive confirmation page for large files)
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        console.log('   Following redirect...');
        return downloadFile(redirectUrl).then(resolve).catch(reject);
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

        // Update progress every 2 seconds
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
        const elapsed = formatTime(Date.now() - startTime);
        const finalSize = formatBytes(downloaded);
        console.log(`\n\n✅ Download complete!`);
        console.log(`   Size: ${finalSize}`);
        console.log(`   Time: ${elapsed}`);
        console.log(`   Location: ${DB_PATH}\n`);
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

downloadFile(downloadUrl)
  .then(() => {
    console.log('🎉 Database ready for use!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Download failed:', err.message);
    console.error('   Will use fallback database if available.\n');

    // Clean up partial download
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    process.exit(0); // Don't fail the deployment, just use fallback
  });
