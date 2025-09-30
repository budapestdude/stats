const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Chess Stats API',
    version: '2.0.0',
    description: 'Comprehensive API for chess statistics, player analysis, and tournament data',
    contact: {
      name: 'Chess Stats Team',
      email: 'chessstats@example.com',
      url: 'https://github.com/yourusername/chess-stats'
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
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication (future implementation)'
      }
    },
    schemas: {
      Player: {
        type: 'object',
        properties: {
          username: { type: 'string', example: 'MagnusCarlsen' },
          title: { type: 'string', example: 'GM', nullable: true },
          name: { type: 'string', example: 'Magnus Carlsen', nullable: true },
          country: { type: 'string', example: 'NO', nullable: true },
          platform: { type: 'string', enum: ['chess.com', 'lichess'] },
          url: { type: 'string', format: 'uri' },
          ratings: {
            type: 'object',
            properties: {
              rapid: { type: 'integer', example: 2830 },
              blitz: { type: 'integer', example: 2886 },
              bullet: { type: 'integer', example: 3184 },
              classical: { type: 'integer', example: 2882 }
            }
          }
        }
      },
      Tournament: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', example: 'Tata Steel Masters 2024' },
          location: { type: 'string', example: 'Wijk aan Zee' },
          date: { type: 'string', format: 'date' },
          rounds: { type: 'integer' },
          players: { type: 'integer' },
          format: { type: 'string', example: 'Round Robin' }
        }
      },
      Opening: {
        type: 'object',
        properties: {
          eco: { type: 'string', example: 'B12' },
          name: { type: 'string', example: 'Caro-Kann Defense' },
          moves: { type: 'string', example: '1.e4 c6' },
          popularity: { type: 'number', format: 'float', example: 8.5 }
        }
      },
      Game: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          white: { type: 'string' },
          black: { type: 'string' },
          result: { type: 'string', enum: ['1-0', '0-1', '1/2-1/2', '*'] },
          eco: { type: 'string' },
          opening: { type: 'string' },
          date: { type: 'string', format: 'date' },
          event: { type: 'string' },
          moves: { type: 'string', nullable: true }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              statusCode: { type: 'integer' },
              stack: { type: 'string', nullable: true }
            }
          }
        }
      },
      RateLimitError: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Too many requests, please try again later' },
              statusCode: { type: 'integer', example: 429 },
              retryAfter: { type: 'integer', example: 60 }
            }
          }
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
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RateLimitError' }
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
      Username: {
        name: 'username',
        in: 'path',
        required: true,
        description: 'Player username',
        schema: { type: 'string' }
      },
      Platform: {
        name: 'platform',
        in: 'query',
        description: 'Chess platform',
        schema: { 
          type: 'string',
          enum: ['chess.com', 'lichess', 'auto'],
          default: 'auto'
        }
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { 
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: { 
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      }
    }
  },
  tags: [
    {
      name: 'Players',
      description: 'Player profiles and statistics'
    },
    {
      name: 'Tournaments',
      description: 'Tournament information and standings'
    },
    {
      name: 'Openings',
      description: 'Chess openings and analysis'
    },
    {
      name: 'Games',
      description: 'Chess games database'
    },
    {
      name: 'Statistics',
      description: 'Platform statistics and analytics'
    },
    {
      name: 'System',
      description: 'System health and cache management'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '..', 'routes', '*.js'),
    path.join(__dirname, '..', 'server-refactored.js'),
    path.join(__dirname, 'swagger-docs.js')
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;