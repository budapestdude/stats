# Chess Stats - The Ultimate Chess Statistics Platform

A comprehensive web application for chess statistics, player analysis, opening exploration, and tournament tracking.

## Features

- **Player Statistics**: Detailed player profiles with rating history, performance metrics, and head-to-head comparisons
- **Opening Explorer**: Interactive opening database with statistics and master game references
- **Game Database**: Search and analyze millions of chess games
- **Tournament Tracking**: Live and historical tournament data with standings and results
- **Data Visualization**: Interactive charts and graphs for rating progression, opening trends, and performance analytics
- **API Access**: RESTful API for developers to access chess statistics programmatically

## Tech Stack

- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL for relational data, Redis for caching
- **Frontend**: Next.js with React (to be implemented)
- **APIs**: Integration with Chess.com and Lichess APIs

## Prerequisites

- Node.js 16+ 
- PostgreSQL 13+
- Redis 6+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chess-stats.git
cd chess-stats
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```bash
createdb chess_stats
psql chess_stats < database/schema.sql
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

5. Start Redis server:
```bash
redis-server
```

6. Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Players
- `GET /api/players` - Get all players with pagination
- `GET /api/players/search` - Search players by name, country, or rating
- `GET /api/players/top` - Get top rated players
- `GET /api/players/:id` - Get player details
- `GET /api/players/:id/games` - Get player's games
- `GET /api/players/:id/statistics` - Get player statistics
- `GET /api/players/:id/rating-history` - Get rating history
- `GET /api/players/:id/openings` - Get player's opening repertoire

### Games
- `GET /api/games` - Get all games
- `GET /api/games/search` - Search games
- `GET /api/games/:id` - Get game details
- `POST /api/games/import/pgn` - Import PGN file

### Openings
- `GET /api/openings` - Get all openings
- `GET /api/openings/explorer` - Opening explorer interface
- `GET /api/openings/popular` - Get popular openings
- `GET /api/openings/eco/:eco` - Get opening by ECO code
- `GET /api/openings/:id/statistics` - Get opening statistics

### Tournaments
- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments/upcoming` - Get upcoming tournaments
- `GET /api/tournaments/:id` - Get tournament details
- `GET /api/tournaments/:id/standings` - Get tournament standings
- `GET /api/tournaments/:id/games` - Get tournament games

### Statistics
- `GET /api/stats/overview` - Platform overview statistics
- `GET /api/stats/rating-distribution` - Rating distribution analysis
- `GET /api/stats/opening-trends` - Opening popularity trends
- `GET /api/stats/country-rankings` - Country-based rankings

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript files
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
chess-stats/
├── src/
│   ├── api/           # External API integrations
│   ├── config/        # Configuration files
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Express middleware
│   ├── models/        # Database models
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   ├── utils/         # Utility functions
│   ├── app.ts         # Express app setup
│   └── server.ts      # Server entry point
├── database/          # Database schemas and migrations
├── frontend/          # Next.js frontend (to be implemented)
├── tests/             # Test files
└── docs/              # Documentation

```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed development timeline and planned features.

## TODO

See [TODO.md](TODO.md) for the complete task list and current progress.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details