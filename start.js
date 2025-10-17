// Node.js startup script for Railway deployment
// This replaces start-railway.sh to avoid shell compatibility issues

const { spawn } = require('child_process');

console.log('=========================================');
console.log('Railway Startup Script (Node.js)');
console.log('=========================================');
console.log('');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Working directory:', process.cwd());
console.log('');

// Step 1: Download database if needed
console.log('Step 1: Running database download script...');

const downloadProcess = spawn('node', ['download-full-db.js'], {
  stdio: 'inherit', // Pass through stdout/stderr
  env: process.env
});

downloadProcess.on('close', (code) => {
  console.log('');
  console.log(`Download script exited with code: ${code}`);
  console.log('');

  if (code !== 0) {
    console.warn('⚠️  Download script failed, but continuing...');
  }

  // Step 1.5: Check database permissions
  const fs = require('fs');
  const path = require('path');
  const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'complete-tournaments.db')
    : path.join(__dirname, 'otb-database', 'complete-tournaments.db');

  if (fs.existsSync(dbPath)) {
    console.log('Step 1.5: Verifying database accessibility...');
    try {
      // Try to open the file for reading
      const fd = fs.openSync(dbPath, 'r');
      fs.closeSync(fd);
      console.log('   ✅ Database file is accessible');
    } catch (err) {
      console.error('   ❌ Database file exists but is not accessible:', err.message);
      console.error('   This is likely a permissions issue with the Railway volume');
      console.error('   The server will start but database queries will fail');
    }
    console.log('');
  }

  // Step 2: Start the server
  console.log('Step 2: Starting server...');
  console.log('Executing: node simple-server-pooled.js');
  console.log('');

  const serverProcess = spawn('node', ['simple-server-pooled.js'], {
    stdio: 'inherit',
    env: process.env
  });

  serverProcess.on('close', (serverCode) => {
    console.error(`❌ Server exited with code: ${serverCode}`);
    process.exit(serverCode);
  });

  serverProcess.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
});

downloadProcess.on('error', (err) => {
  console.error('❌ Failed to run download script:', err);
  console.error('Continuing to server startup anyway...');

  // Try to start server even if download fails
  const serverProcess = spawn('node', ['simple-server-pooled.js'], {
    stdio: 'inherit',
    env: process.env
  });

  serverProcess.on('error', (serverErr) => {
    console.error('❌ Failed to start server:', serverErr);
    process.exit(1);
  });
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
