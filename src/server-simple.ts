import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());

// Test endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Chess Stats API is running!'
  });
});

// Test API endpoints
app.get('/api/test', (_req, res) => {
  res.json({ message: 'API is working!' });
});

app.get('/api/stats/overview', (_req, res) => {
  res.json({
    totalPlayers: 2547893,
    totalGames: 100000000,
    totalTournaments: 5432,
    averageRating: 1485,
    message: 'Test data - database not connected'
  });
});

app.get('/api/players/top', (_req, res) => {
  res.json([
    { id: '1', username: 'MagnusCarlsen', title: 'GM', country: 'NOR', current_ratings: { classical: 2839 } },
    { id: '2', username: 'FabianoCaruana', title: 'GM', country: 'USA', current_ratings: { classical: 2805 } },
    { id: '3', username: 'Hikaru', title: 'GM', country: 'USA', current_ratings: { classical: 2802 } },
    { id: '4', username: 'DingLiren', title: 'GM', country: 'CHN', current_ratings: { classical: 2780 } },
    { id: '5', username: 'Nepo', title: 'GM', country: 'RUS', current_ratings: { classical: 2771 } },
  ]);
});

app.get('/api/players', (_req, res) => {
  res.json({
    players: [
      { id: '1', username: 'MagnusCarlsen', title: 'GM', country: 'NOR', current_ratings: { classical: 2839 } },
      { id: '2', username: 'FabianoCaruana', title: 'GM', country: 'USA', current_ratings: { classical: 2805 } },
    ],
    page: 1,
    limit: 20,
    total: 2
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📊 Test the API at http://localhost:${PORT}/health`);
  console.log(`🎯 Frontend should connect to http://localhost:${PORT}/api`);
});

export default app;