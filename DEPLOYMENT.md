# Chess Stats Production Deployment Guide

## Quick Start

For rapid deployment, use the automated script:
```bash
./deploy.sh production
```

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ LTS
- 4GB+ RAM, 20GB+ storage
- Domain name configured
- SSL certificates (auto-generated with Let's Encrypt)

## Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nodejs npm nginx redis-server sqlite3 git

# Install PM2
sudo npm install -g pm2
```

### 2. Application Setup

```bash
# Clone repository
git clone <your-repo-url> chess-stats
cd chess-stats

# Install dependencies
npm ci --production
cd frontend && npm ci --production && npm run build
cd ..

# Generate secrets
node scripts/generate-secrets.js

# Configure environment
cp .env.production.example .env.production
# Edit .env.production with your values
```

### 3. Database Optimization

```bash
# Optimize database
node scripts/optimize-db.js
```

### 4. Start Application

```bash
# Using PM2
pm2 start simple-server-pooled.js --name chess-stats
pm2 save
pm2 startup

# Or using Docker
docker-compose up -d
```

### 5. Configure Nginx

```bash
# Copy configuration
sudo cp nginx/nginx.conf /etc/nginx/sites-available/chess-stats
sudo ln -s /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com
```

## Monitoring

- Health check: `https://yourdomain.com/health`
- Metrics: `https://yourdomain.com/monitoring/metrics`
- PM2 monitoring: `pm2 monit`

## Maintenance

### Daily
- Check logs: `pm2 logs`
- Monitor health endpoint

### Weekly
- Review metrics
- Check disk space: `df -h`

### Monthly
- Optimize database: `node scripts/optimize-db.js`
- Update dependencies (carefully)

## Troubleshooting

### Application won't start
```bash
pm2 logs
node --version  # Should be 18+
```

### Database errors
```bash
sqlite3 otb-database/complete-tournaments.db "PRAGMA integrity_check;"
```

### High memory usage
```bash
pm2 restart chess-stats
```

## Support

- Logs: `logs/` directory
- Documentation: See README.md
- Issues: GitHub Issues page