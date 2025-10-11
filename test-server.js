// Minimal test server to verify Railway deployment
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3007;

console.log('🚀 Starting minimal test server...');
console.log(`   PORT: ${PORT}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   RAILWAY_VOLUME_MOUNT_PATH: ${process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set'}`);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Minimal test server is running!',
    env: {
      port: PORT,
      node_env: process.env.NODE_ENV,
      volume_path: process.env.RAILWAY_VOLUME_MOUNT_PATH
    }
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Test server root' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
  console.log(`📊 Test at http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
