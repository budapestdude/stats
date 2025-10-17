// Upload database to Railway in chunks
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'otb-database', 'railway-subset.db');
const RAILWAY_URL = 'https://stats-production-10e3.up.railway.app';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

async function uploadDatabase() {
  console.log('📦 Preparing to upload database...\n');

  const stats = fs.statSync(DB_PATH);
  const fileSize = stats.size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Chunks: ${totalChunks} × 10MB\n`);

  const fileStream = fs.createReadStream(DB_PATH, { highWaterMark: CHUNK_SIZE });
  let chunkIndex = 0;
  let uploadedBytes = 0;

  for await (const chunk of fileStream) {
    chunkIndex++;
    const progress = ((chunkIndex / totalChunks) * 100).toFixed(1);

    console.log(`Uploading chunk ${chunkIndex}/${totalChunks} (${progress}%)...`);

    try {
      const formData = new FormData();
      const blob = new Blob([chunk]);
      formData.append('chunk', blob);
      formData.append('chunkIndex', chunkIndex);
      formData.append('totalChunks', totalChunks);

      await axios.post(`${RAILWAY_URL}/admin/upload-chunk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });

      uploadedBytes += chunk.length;
    } catch (error) {
      console.error(`✗ Chunk ${chunkIndex} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ Upload complete!');
  console.log('   Finalizing database...');

  // Finalize
  await axios.post(`${RAILWAY_URL}/admin/finalize-db`);

  console.log('🎉 Database ready on Railway!\n');
}

uploadDatabase().catch(error => {
  console.error('Upload failed:', error);
  process.exit(1);
});
