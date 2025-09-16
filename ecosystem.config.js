module.exports = {
  apps: [
    {
      name: 'chess-stats',
      script: 'server-secure.js',
      cwd: '/app',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3007
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3007,
        REDIS_ENABLED: true
      },
      
      // Logging
      log_file: './logs/chess-stats.log',
      out_file: './logs/chess-stats-out.log',
      error_file: './logs/chess-stats-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart options
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Advanced PM2 options
      kill_timeout: 1600,
      listen_timeout: 3000,
      
      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Memory and CPU limits
      max_memory_restart: '1G',
      
      // Graceful shutdown
      kill_timeout: 5000
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/chess-stats.git',
      path: '/var/www/chess-stats',
      
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'post-setup': 'ls -la'
    }
  }
};