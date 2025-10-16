const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Chess Stats API',
    version: '1.0.0',
    description: 'Comprehensive API for chess statistics, player analysis, and tournament tracking',
    contact: {
      name: 'Chess Stats Team',
      email: 'support@chessstats.com',
      url: 'https://chessstats.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: config.app.url,
      description: 'Current Environment',
    },
    {
      url: 'http://localhost:3008',
      description: 'Development Server',
    },
    {
      url: 'https://api.chessstats.com',
      description: 'Production Server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints',
    },
    {
      name: 'Players',
      description: 'Player data and statistics',
    },
    {
      name: 'Games',
      description: 'Chess game data and analysis',
    },
    {
      name: 'Openings',
      description: 'Opening explorer and statistics',
    },
    {
      name: 'Tournaments',
      description: 'Tournament information and standings',
    },
    {
      name: 'Statistics',
      description: 'Platform-wide statistics and analytics',
    },
    {
      name: 'Cache',
      description: 'Cache management and monitoring',
    },
    {
      name: 'WebSocket',
      description: 'Real-time WebSocket events',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service communication',
      },
    },
    schemas: {
      // User schemas
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', minLength: 3, maxLength: 30 },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'moderator', 'user'] },
          isActive: { type: 'boolean' },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      
      // Player schemas
      Player: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          name: { type: 'string' },
          title: { type: 'string', nullable: true },
          country: { type: 'string' },
          location: { type: 'string', nullable: true },
          joined: { type: 'integer' },
          status: { type: 'string' },
          isStreamer: { type: 'boolean' },
          verified: { type: 'boolean' },
          followers: { type: 'integer' },
          url: { type: 'string', format: 'uri' },
          ratings: {
            type: 'object',
            properties: {
              blitz: { $ref: '#/components/schemas/Rating' },
              rapid: { $ref: '#/components/schemas/Rating' },
              bullet: { $ref: '#/components/schemas/Rating' },
              daily: { $ref: '#/components/schemas/Rating' },
              puzzle: { $ref: '#/components/schemas/Rating' },
            },
          },
        },
      },
      
      Rating: {
        type: 'object',
        properties: {
          rating: { type: 'integer' },
          rd: { type: 'integer' },
          games: { type: 'integer' },
          prog: { type: 'integer' },
        },
      },
      
      // Game schemas
      Game: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          white: { type: 'string' },
          black: { type: 'string' },
          result: { type: 'string' },
          date: { type: 'string', format: 'date' },
          event: { type: 'string' },
          opening: { type: 'string' },
          eco: { type: 'string' },
          pgn: { type: 'string' },
          timeControl: { type: 'string' },
          termination: { type: 'string' },
        },
      },
      
      // Opening schemas
      Opening: {
        type: 'object',
        properties: {
          eco: { type: 'string' },
          name: { type: 'string' },
          moves: { type: 'string' },
          fen: { type: 'string' },
          popularity: { type: 'number' },
          winRate: { type: 'number' },
          drawRate: { type: 'number' },
          lossRate: { type: 'number' },
        },
      },
      
      // Tournament schemas
      Tournament: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          status: { type: 'string', enum: ['upcoming', 'ongoing', 'finished'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          players: { type: 'integer' },
          rounds: { type: 'integer' },
          timeControl: { type: 'string' },
        },
      },
      
      // Error schemas
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      
      // Success response
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
    
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ValidationError: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './routes/*.js',
    './server-refactored.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar {
    display: none;
  }
  .swagger-ui .wrapper {
    padding: 20px;
  }
  .swagger-ui .info .title {
    color: #2563eb;
  }
`;

const swaggerOptions = {
  customCss,
  customSiteTitle: 'Chess Stats API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayOperationId: false,
    filter: true,
    tryItOutEnabled: true,
  },
};

module.exports = {
  swaggerUi,
  swaggerSpec,
  swaggerOptions,
};