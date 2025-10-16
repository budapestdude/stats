import app from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    console.log('✅ Database connected');
    
    await connectRedis();
    console.log('✅ Redis connected');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Chess Stats API ready at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});