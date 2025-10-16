import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import playerRoutes from './routes/playerRoutes';
import gameRoutes from './routes/gameRoutes';
import openingRoutes from './routes/openingRoutes';
import tournamentRoutes from './routes/tournamentRoutes';
import statsRoutes from './routes/statsRoutes';

dotenv.config();

const app: Application = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/openings', openingRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;