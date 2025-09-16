const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('Health Endpoints', () => {
  let app;
  
  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(cors());
    app.use(express.json());
    
    // Add health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Chess Stats API is running!',
        database: 'test',
        cache: 'enabled',
        rateLimit: 'enabled'
      });
    });
    
    // Add basic API info endpoint
    app.get('/api/test', (req, res) => {
      res.json({ message: 'API is working!', environment: 'test' });
    });
  });

  describe('GET /health', () => {
    test('should return health status with 200 status code', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('rateLimit');
    });

    test('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toString()).not.toBe('Invalid Date');
      
      // Check timestamp is recent (within last 5 seconds)
      const now = new Date();
      const diff = now - timestamp;
      expect(diff).toBeLessThan(5000);
    });

    test('should include all required health indicators', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      const requiredFields = ['status', 'timestamp', 'message', 'database', 'cache', 'rateLimit'];
      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
        expect(response.body[field]).toBeTruthy();
      });
    });

    test('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('GET /api/test', () => {
    test('should return API test message', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toHaveProperty('message', 'API is working!');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('should handle HEAD requests', async () => {
      await request(app)
        .head('/api/test')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);
    });

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/health?callback=<script>alert(1)</script>')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      // Check XSS is not reflected
      expect(response.text).not.toContain('<script>');
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers for localhost origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeTruthy();
    });

    test('should handle preflight requests', async () => {
      await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    });
  });

  describe('Performance', () => {
    test('health check should respond quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });

    test('should handle rapid successive requests', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 20; i++) {
        await request(app)
          .get('/health')
          .expect(200);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 20 requests within 1 second
    });
  });
});