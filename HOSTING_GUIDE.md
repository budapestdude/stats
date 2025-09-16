# Chess Stats Hosting Guide

## Recommended Hosting Solutions (Ranked by Suitability)

### 🥇 Option 1: DigitalOcean (BEST OVERALL)
**Perfect for your stack with excellent price/performance**

#### Setup:
```bash
# 1. Create Droplet (Recommended: 4GB RAM, 2 vCPUs, $24/month)
# 2. Attach Block Storage for database (100GB, $10/month)
# 3. Use DigitalOcean App Platform for frontend ($5/month)
```

#### Advantages:
- **Cost**: ~$40/month total
- **Database**: SSD block storage perfect for 3.7GB SQLite
- **Scaling**: Easy vertical/horizontal scaling
- **Managed Database**: Option to migrate to managed PostgreSQL later
- **CDN**: Built-in CDN with Spaces ($5/month)
- **Monitoring**: Free basic monitoring included

#### Deployment:
```yaml
# docker-compose.yml for DigitalOcean
version: '3.8'
services:
  app:
    image: chess-stats:latest
    ports:
      - "80:3010"
    volumes:
      - /mnt/volume_nyc1_01:/app/otb-database
    environment:
      - NODE_ENV=production
```

---

### 🥈 Option 2: Railway.app (EASIEST SETUP)
**One-click deployment with automatic scaling**

#### Setup:
```bash
# 1. Connect GitHub repo
# 2. Railway auto-deploys on push
railway login
railway link
railway up
```

#### Advantages:
- **Cost**: ~$20/month (usage-based)
- **Simplicity**: Zero DevOps required
- **Database**: Persistent volumes for SQLite
- **SSL**: Automatic HTTPS
- **Scaling**: Automatic with no configuration

#### Configuration:
```toml
# railway.toml
[build]
builder = "DOCKERFILE"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"

[[services]]
name = "chess-stats"
port = 3010
```

---

### 🥉 Option 3: AWS (MOST SCALABLE)
**Enterprise-grade with complete control**

#### Architecture:
```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│ CloudFront │────▶│  ALB     │────▶│  ECS/EC2    │
│    CDN      │     │   LB     │     │  Containers │
└─────────────┘     └──────────┘     └─────────────┘
                                            │
                                      ┌─────▼─────┐
                                      │   EFS     │
                                      │ Database  │
                                      └───────────┘
```

#### Setup:
```bash
# Using AWS Copilot (simplified ECS)
copilot app init chess-stats
copilot env init --name production
copilot svc init --name api
copilot svc deploy --name api --env production
```

#### Services:
- **EC2**: t3.medium instance ($30/month)
- **EFS**: For SQLite database persistence ($30/month)
- **CloudFront**: CDN for global distribution
- **ALB**: Application Load Balancer
- **Route53**: DNS management

#### Advantages:
- **Scalability**: Auto-scaling groups
- **Reliability**: Multi-AZ deployment
- **Performance**: CloudFront CDN
- **Monitoring**: CloudWatch included

---

## 💰 Cost Comparison Table

| Provider | Monthly Cost | Setup Complexity | Best For |
|----------|-------------|------------------|----------|
| **DigitalOcean** | $40-60 | Medium | Best overall value |
| **Railway** | $20-40 | Easy | Quick deployment |
| **AWS** | $60-100 | Complex | Enterprise scale |
| **Vercel** | $20 + backend | Easy | Frontend only |
| **Fly.io** | $25-50 | Medium | Global edge deployment |
| **Render** | $25-50 | Easy | Simple full-stack |
| **Google Cloud Run** | $30-60 | Medium | Serverless scaling |
| **Hetzner** | $15-30 | Hard | Budget option |

---

## 🚀 Quick Start: DigitalOcean Deployment

### Step 1: Prepare Your Application
```bash
# Build Docker image
docker build -t chess-stats:latest .

# Test locally
docker run -p 3010:3010 chess-stats:latest
```

### Step 2: Create DigitalOcean Droplet
```bash
# Install doctl CLI
brew install doctl  # or download from GitHub

# Authenticate
doctl auth init

# Create droplet with Docker pre-installed
doctl compute droplet create chess-stats \
  --size s-2vcpu-4gb \
  --image docker-20-04 \
  --region nyc1 \
  --ssh-keys YOUR_SSH_KEY_ID
```

### Step 3: Setup Block Storage
```bash
# Create volume for database
doctl compute volume create chess-stats-db \
  --size 100 \
  --region nyc1

# Attach to droplet
doctl compute volume-action attach VOLUME_ID DROPLET_ID
```

### Step 4: Deploy Application
```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Mount volume
mkdir -p /mnt/chess-stats-db
mount -o defaults,nofail,discard,noatime /dev/disk/by-id/scsi-0DO_Volume_chess-stats-db /mnt/chess-stats-db

# Clone repository
git clone https://github.com/yourusername/chess-stats.git
cd chess-stats

# Copy database to volume
cp otb-database/complete-tournaments.db /mnt/chess-stats-db/

# Create production env
cp .env.example .env.production
nano .env.production  # Edit with production values

# Run with Docker Compose
docker-compose -f docker-compose.yml up -d
```

### Step 5: Setup Nginx & SSL
```bash
# Install Nginx
apt update && apt install nginx certbot python3-certbot-nginx

# Configure Nginx
cat > /etc/nginx/sites-available/chess-stats <<EOF
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Setup SSL with Let's Encrypt
certbot --nginx -d yourdomain.com
```

### Step 6: Setup Monitoring
```bash
# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash

# Setup automatic backups
crontab -e
# Add: 0 2 * * * /root/chess-stats/scripts/backup.sh
```

---

## 🌍 CDN Setup (Cloudflare)

### Free Tier Setup:
```bash
# 1. Add your domain to Cloudflare
# 2. Update nameservers at your registrar
# 3. Configure DNS records:
#    A record: @ -> YOUR_SERVER_IP
#    CNAME: www -> @

# 4. Enable these Cloudflare features:
#    - Auto Minify (JS, CSS, HTML)
#    - Brotli compression
#    - Browser Cache TTL: 4 hours
#    - Always Online
#    - Rocket Loader
```

### Page Rules (Free: 3 rules):
```
1. *yourdomain.com/api/*
   - Cache Level: Bypass
   - Disable Performance

2. *yourdomain.com/static/*
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

3. *yourdomain.com/*
   - Cache Level: Standard
   - Minify: All
```

---

## 📊 Database Hosting Considerations

### SQLite Optimization for Production:
```bash
# Enable WAL mode for better concurrency
sqlite3 complete-tournaments.db "PRAGMA journal_mode=WAL;"
sqlite3 complete-tournaments.db "PRAGMA synchronous=NORMAL;"
sqlite3 complete-tournaments.db "PRAGMA cache_size=10000;"
sqlite3 complete-tournaments.db "PRAGMA temp_store=MEMORY;"
```

### Migration Path to PostgreSQL (if needed):
```bash
# Use pgloader for migration
apt install pgloader

# Create migration script
cat > migrate.load <<EOF
LOAD DATABASE
  FROM sqlite:///path/to/complete-tournaments.db
  INTO postgresql://user:pass@localhost/chess_stats
WITH
  create tables, create indexes, reset sequences,
  workers = 4, concurrency = 1
SET
  work_mem to '32MB',
  maintenance_work_mem to '64MB';
EOF

pgloader migrate.load
```

---

## 🔧 Performance Optimization

### Server Optimization:
```nginx
# /etc/nginx/nginx.conf additions
http {
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml application/atom+xml image/svg+xml
               text/javascript application/x-font-ttf font/opentype
               application/vnd.ms-fontobject image/x-icon;

    # Connection optimization
    keepalive_timeout 65;
    keepalive_requests 100;

    # Buffer sizes
    client_body_buffer_size 16K;
    client_header_buffer_size 1k;
    client_max_body_size 10m;
    large_client_header_buffers 2 1k;

    # Cache settings
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=cache:10m
                     max_size=1g inactive=60m use_temp_path=off;
}
```

### Database Optimization:
```javascript
// Add to simple-server-pooled.js
const optimizeDatabase = async () => {
  const db = await pool.acquire();

  // Run optimization commands
  await db.run("PRAGMA optimize");
  await db.run("VACUUM");
  await db.run("ANALYZE");

  await pool.release(db);
};

// Run weekly
setInterval(optimizeDatabase, 7 * 24 * 60 * 60 * 1000);
```

---

## 🚨 Monitoring Setup

### Essential Monitoring Services:

#### 1. Uptime Monitoring (UptimeRobot - Free)
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
    database: db ? 'connected' : 'disconnected'
  };
  res.status(200).json(health);
});
```

#### 2. Error Tracking (Sentry - Free tier)
```bash
npm install @sentry/node

# Add to server
Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  tracesSampleRate: 0.1,
});
```

#### 3. Analytics (Plausible - Privacy-friendly)
```html
<!-- Add to frontend -->
<script defer data-domain="yourdomain.com"
        src="https://plausible.io/js/script.js"></script>
```

---

## 📋 Pre-Launch Checklist

- [ ] Domain name registered and configured
- [ ] SSL certificate installed and auto-renewal setup
- [ ] Database backed up to cloud storage
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] Error tracking connected
- [ ] Uptime monitoring active
- [ ] CDN configured
- [ ] Firewall rules configured
- [ ] SSH key-only access enabled
- [ ] Automated backups scheduled
- [ ] Load testing completed
- [ ] Rollback procedure tested
- [ ] Documentation updated

---

## 💡 Final Recommendations

### For Your Specific Use Case:
1. **Start with DigitalOcean** - Best balance of features and cost
2. **Use Cloudflare** - Free CDN and DDoS protection
3. **Keep SQLite initially** - Your indexes make it performant
4. **Monitor closely** - Watch for slow queries as you scale
5. **Plan for growth** - Have PostgreSQL migration ready

### First Month Budget:
- DigitalOcean Droplet: $24
- Block Storage: $10
- Domain: $12/year
- **Total: ~$35/month**

### Scaling Path:
1. **0-1,000 users**: Current setup
2. **1,000-10,000 users**: Add Redis caching
3. **10,000-50,000 users**: Migrate to PostgreSQL
4. **50,000+ users**: Add read replicas, CDN

---

## 🆘 Troubleshooting Common Issues

### High Memory Usage
```bash
# Check memory
free -h

# Clear cache
sync && echo 3 > /proc/sys/vm/drop_caches

# Restart container
docker-compose restart
```

### Slow Queries
```sql
-- Check slow queries
EXPLAIN QUERY PLAN
SELECT * FROM games
WHERE white_player = 'Magnus Carlsen';

-- Rebuild indexes if needed
REINDEX;
```

### Disk Space Issues
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a -f

# Rotate logs
truncate -s 0 /var/log/nginx/*.log
```

---

Last Updated: 2025-01-13
Ready for Production Launch!