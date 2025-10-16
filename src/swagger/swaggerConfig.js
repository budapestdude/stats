const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chess Stats API',
      version: '1.0.0',
      description: 'Comprehensive chess statistics API with player data, game analysis, and tournament tracking',
      contact: {
        name: 'Chess Stats Support',
        email: 'support@chessstats.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3007',
        description: 'Development server'
      },
      {
        url: 'https://api.chessstats.com',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Player: {
          type: 'object',
          properties: {
            username: { type: 'string', example: 'magnuscarlsen' },
            title: { type: 'string', example: 'GM' },
            name: { type: 'string', example: 'Magnus Carlsen' },
            country: { type: 'string', example: 'NO' },
            followers: { type: 'integer', example: 123456 },
            joined: { type: 'integer', example: 1357077600 },
            last_online: { type: 'integer', example: 1698768000 },
            avatar: { type: 'string', example: 'https://images.chesscomfiles.com/uploads/v1/user/52462330.jpg' },
            status: { type: 'string', example: 'premium' }
          }
        },
        PlayerStats: {
          type: 'object',
          properties: {
            chess_blitz: {
              type: 'object',
              properties: {
                last: {
                  type: 'object',
                  properties: {
                    rating: { type: 'integer', example: 3224 },
                    date: { type: 'integer', example: 1698768000 },
                    rd: { type: 'integer', example: 41 }
                  }
                },
                best: {
                  type: 'object',
                  properties: {
                    rating: { type: 'integer', example: 3336 },
                    date: { type: 'integer', example: 1653523200 },
                    game: { type: 'string', example: 'https://www.chess.com/game/live/48261664171' }
                  }
                },
                record: {
                  type: 'object',
                  properties: {
                    win: { type: 'integer', example: 2518 },
                    loss: { type: 'integer', example: 388 },
                    draw: { type: 'integer', example: 321 }
                  }
                }
              }
            },
            chess_rapid: { 
              type: 'object',
              properties: {
                last: { type: 'object' },
                best: { type: 'object' },
                record: { type: 'object' }
              }
            },
            chess_bullet: { 
              type: 'object',
              properties: {
                last: { type: 'object' },
                best: { type: 'object' },
                record: { type: 'object' }
              }
            }
          }
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'game_123456' },
            white: {
              type: 'object',
              properties: {
                username: { type: 'string', example: 'magnuscarlsen' },
                rating: { type: 'integer', example: 2847 },
                result: { type: 'string', enum: ['win', 'loss', 'draw'] }
              }
            },
            black: {
              type: 'object',
              properties: {
                username: { type: 'string', example: 'hikaru' },
                rating: { type: 'integer', example: 2736 },
                result: { type: 'string', enum: ['win', 'loss', 'draw'] }
              }
            },
            pgn: { type: 'string', example: '1. e4 c5 2. Nf3 d6...' },
            time_control: { type: 'string', example: '300+0' },
            end_time: { type: 'integer', example: 1698768000 },
            rated: { type: 'boolean', example: true },
            rules: { type: 'string', example: 'chess' },
            eco: { type: 'string', example: 'B20' },
            opening: { type: 'string', example: 'Sicilian Defense' }
          }
        },
        Tournament: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'tournament_123' },
            name: { type: 'string', example: 'World Chess Championship 2024' },
            location: { type: 'string', example: 'Dubai, UAE' },
            start_date: { type: 'string', format: 'date', example: '2024-11-20' },
            end_date: { type: 'string', format: 'date', example: '2024-12-15' },
            rounds: { type: 'integer', example: 14 },
            participants: { type: 'integer', example: 8 },
            time_control: { type: 'string', example: 'Classical' },
            prize_pool: { type: 'number', example: 2800000 }
          }
        },
        Opening: {
          type: 'object',
          properties: {
            eco: { type: 'string', example: 'B20' },
            name: { type: 'string', example: 'Sicilian Defense' },
            moves: { type: 'string', example: '1. e4 c5' },
            popularity: { type: 'integer', example: 8534 },
            white_win_rate: { type: 'number', example: 54.2 },
            black_win_rate: { type: 'number', example: 41.3 },
            draw_rate: { type: 'number', example: 4.5 }
          }
        },
        CacheStats: {
          type: 'object',
          properties: {
            cache: {
              type: 'object',
              properties: {
                hits: { type: 'integer', example: 1234 },
                misses: { type: 'integer', example: 567 },
                hitRate: { type: 'number', example: 68.5 },
                uptime: { type: 'integer', example: 3600 },
                type: { type: 'string', example: 'memory' },
                available: { type: 'boolean', example: true }
              }
            },
            rateLimit: {
              type: 'object',
              properties: {
                blocked: { type: 'integer', example: 12 },
                passed: { type: 'integer', example: 4567 },
                blockRate: { type: 'string', example: '0.26%' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Resource not found' },
            message: { type: 'string', example: 'The requested player was not found' },
            statusCode: { type: 'integer', example: 404 }
          }
        }
      },
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        RateLimited: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Too many requests' },
                  retryAfter: { type: 'integer', example: 60 }
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      },
      parameters: {
        username: {
          name: 'username',
          in: 'path',
          required: true,
          description: 'Chess.com or Lichess username',
          schema: { type: 'string', example: 'magnuscarlsen' }
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of results',
          schema: { type: 'integer', default: 100, minimum: 1, maximum: 1000 }
        },
        offset: {
          name: 'offset',
          in: 'query',
          description: 'Offset for pagination',
          schema: { type: 'integer', default: 0, minimum: 0 }
        }
      }
    },
    tags: [
      { name: 'Health', description: 'API health and status endpoints' },
      { name: 'Players', description: 'Player profiles and statistics' },
      { name: 'Games', description: 'Chess games and analysis' },
      { name: 'Openings', description: 'Opening explorer and statistics' },
      { name: 'Tournaments', description: 'Tournament data and results' },
      { name: 'Statistics', description: 'Platform-wide statistics' },
      { name: 'Cache', description: 'Cache management and monitoring' },
      { name: 'OTB Database', description: 'Over-the-board tournament database' }
    ]
  },
  apis: ['./src/swagger/*.yaml', './simple-server*.js', './src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;