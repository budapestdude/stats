# Budget & Free Hosting Guide for Chess Stats

## 🎯 FREE Hosting Options (Actually Free!)

### Option 1: Render.com (FREE)
**Completely free with limitations**

```yaml
# render.yaml
services:
  - type: web
    name: chess-stats
    runtime: node
    buildCommand: npm install
    startCommand: node simple-server-pooled.js
    disk:
      name: chess-data
      mountPath: /var/data
      sizeGB: 1  # Free tier includes 1GB persistent disk
```

**Limitations:**
- Spins down after 15 min inactivity (slow cold starts)
- 1GB persistent disk (need to optimize database)
- Limited CPU/RAM
- Free custom domain

**Solution for 3.7GB database:**
```bash
# Compress database to fit in 1GB
sqlite3 complete-tournaments.db "VACUUM;"
# Or split database into essential data only
```

---

### Option 2: Fly.io (FREE - $5 credit/month)
**Generous free tier, great for SQLite**

```toml
# fly.toml
app = "chess-stats"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[mounts]
  source = "chess_data"
  destination = "/data"

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80

  [[services.ports]]
    port = 443
```

```bash
# Deploy to Fly.io
fly launch
fly volumes create chess_data --size 5  # 5GB free
fly deploy
```

**Free Includes:**
- 3 shared VMs (1 CPU, 256MB RAM each)
- 5GB persistent volumes
- 160GB outbound transfer
- Perfect for SQLite!

---

### Option 3: Oracle Cloud (ALWAYS FREE)
**Most generous free tier - seriously!**

**Free Forever:**
- 2 AMD VMs (1/8 OCPU, 1GB RAM each)
- 200GB block storage total
- 10GB object storage
- 10TB outbound data transfer/month

```bash
# Setup Oracle Cloud VM
# 1. Sign up at cloud.oracle.com (credit card required but never charged)
# 2. Create Always Free VM instance
# 3. Attach 50GB block volume (free)

# SSH into instance
ssh ubuntu@YOUR_INSTANCE_IP

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone and run your app
git clone https://github.com/yourusername/chess-stats.git
cd chess-stats
sudo docker-compose up -d
```

---

## 💰 Ultra-Budget Paid Options

### Option 4: Hetzner Cloud (€4.51/month = ~$5)
**Best value in Europe**

```bash
# CX11 Instance: 2GB RAM, 20GB SSD, 20TB traffic
# Add 20GB volume: €1/month

# Total: ~€5.50/month ($6)
```

**Setup:**
```bash
# Create server via Hetzner Cloud Console
# Choose Ubuntu 22.04, CX11 type

# SSH and setup
ssh root@YOUR_SERVER_IP
apt update && apt install docker.io docker-compose
# Deploy your app
```

---

### Option 5: Hostinger VPS (Starting $3.99/month)
**When on sale, great value**

- 1 vCPU, 1GB RAM
- 20GB SSD
- 1TB bandwidth
- Often has 70-80% off sales

---

## 🚀 ULTIMATE FREE SETUP (Recommended)

### Combination Approach: Split Your Services

**Frontend (Vercel) - FREE**
```bash
# Deploy Next.js frontend
cd frontend
vercel deploy
# Custom domain free
```

**Backend API (Fly.io) - FREE**
```bash
# Deploy Express backend
fly launch
fly volumes create data --size 5
fly deploy
```

**Database (Turso) - FREE**
```bash
# SQLite-compatible edge database
# 8GB storage, 1B row reads/month free
turso db create chess-stats
turso db shell chess-stats < complete-tournaments.db
```

**File Storage (Cloudflare R2) - FREE**
```bash
# 10GB storage, 10M requests/month free
# Store large PGN files here
```

---

## 🔧 Database Size Optimization

### Reduce Database from 3.7GB to <1GB:

```sql
-- Create lightweight version with only essential data
-- Keep only games from last 5 years
CREATE TABLE games_lite AS
SELECT * FROM games
WHERE date > '2019-01-01';

-- Remove unnecessary columns
ALTER TABLE games_lite DROP COLUMN pgn_file;

-- Create summary tables instead of full data
CREATE TABLE player_stats AS
SELECT
  player_name,
  COUNT(*) as total_games,
  AVG(rating) as avg_rating
FROM (
  SELECT white_player as player_name, white_rating as rating FROM games
  UNION ALL
  SELECT black_player as player_name, black_rating as rating FROM games
)
GROUP BY player_name;

-- Vacuum to reclaim space
VACUUM;
```

---

## 🏠 Self-Hosting at Home (FREE)

### Use Your Own Computer:

```bash
# Use ngrok for public access
npm install -g ngrok
node simple-server-pooled.js &
ngrok http 3010

# Or use Cloudflare Tunnel (better)
# 1. Sign up for free Cloudflare account
# 2. Install cloudflared
cloudflared tunnel create chess-stats
cloudflared tunnel route dns chess-stats yourdomain.com
cloudflared tunnel run chess-stats
```

**Pros:**
- Completely free
- Full control
- No limitations

**Cons:**
- Computer must stay on
- Residential IP issues
- Upload speed limitations

---

## 📊 Cost Comparison Table

| Provider | Monthly Cost | Storage | Limitations |
|----------|-------------|---------|-------------|
| **Render** | FREE | 1GB | Sleeps after 15min |
| **Fly.io** | FREE | 5GB | 256MB RAM |
| **Oracle Cloud** | FREE | 200GB | 1GB RAM |
| **Railway** | FREE→$5 | 5GB | $5 credit/month |
| **Vercel+Supabase** | FREE | 500MB | API limits |
| **Hetzner** | $5-6 | 20-40GB | EU only |
| **Home+Cloudflare** | FREE | Unlimited | Always on PC |

---

## 🎯 RECOMMENDED: The $0 Production Setup

### 1. Frontend on Vercel (FREE)
```bash
cd frontend
npm run build
vercel --prod
# Connect custom domain free
```

### 2. Backend on Fly.io (FREE)
```bash
# Modify simple-server-pooled.js to use less memory
const pool = getPool({
  maxConnections: 5,  # Reduced from 15
  minConnections: 1   # Reduced from 3
});

fly launch --name chess-stats-api
fly volumes create data --size 5
fly deploy
```

### 3. Optimize Database
```javascript
// create-lite-database.js
const sqlite3 = require('sqlite3');

const source = new sqlite3.Database('complete-tournaments.db');
const target = new sqlite3.Database('chess-stats-lite.db');

// Copy only essential tables and recent data
target.serialize(() => {
  target.run(`CREATE TABLE games AS
    SELECT id, white_player, black_player, result, date, eco, opening
    FROM games
    WHERE date > '2020-01-01'
    LIMIT 1000000`);

  target.run(`CREATE INDEX idx_players ON games(white_player, black_player)`);
  target.run(`CREATE INDEX idx_date ON games(date)`);
  target.run(`VACUUM`);
});
```

### 4. CDN with Cloudflare (FREE)
```bash
# Add your domain to Cloudflare
# Point to fly.io backend
# Enable caching, minification, etc.
```

---

## 💡 Money-Saving Tips

### 1. Use GitHub Student Pack (if eligible)
- $100 DigitalOcean credit
- $50 Linode credit
- Free domain name
- And much more!

### 2. Apply for Startup Credits
- AWS Activate: Up to $100k credits
- Google Cloud: Up to $100k credits
- Azure: Up to $150k credits
- Just need to apply with your project

### 3. Use Free Tiers Strategically
```javascript
// Rotate between providers every year
Year 1: Oracle Cloud (always free)
Year 2: Google Cloud ($300 credit)
Year 3: AWS (12 months free tier)
```

### 4. Optimize Everything
```bash
# Compress all assets
npm run build
gzip -9 dist/*.js

# Use Brotli compression
apt install brotli
brotli dist/*.js

# Minify database
sqlite3 database.db "VACUUM;"
```

---

## 🚀 Quick Start: Deploy for $0 Today

```bash
# Step 1: Optimize your database (reduce to <1GB)
node scripts/create-lite-database.js

# Step 2: Deploy frontend to Vercel
cd frontend
vercel --prod

# Step 3: Deploy backend to Fly.io
fly launch
fly deploy

# Step 4: Setup Cloudflare
# - Add domain
# - Point to Fly.io
# - Enable free features

# Total cost: $0/month
# Total time: 30 minutes
```

---

## 📈 When to Upgrade

Stay free until you have:
- 1,000+ daily active users
- 10,000+ API requests/day
- Need 99.9% uptime SLA
- Making revenue from the app

Then upgrade to:
- Hetzner ($6/month) for simple upgrade
- DigitalOcean ($24/month) for professional setup
- AWS/GCP when you're making $1000+/month

---

## 🎁 BONUS: Get Paid to Host!

### Monetization Options:
1. **Add ads**: Google AdSense ($50-500/month)
2. **Premium features**: Charge for advanced analytics
3. **API access**: Charge developers for API usage
4. **Sponsorships**: Chess companies may sponsor

With just 100 users paying $5/month for premium = $500/month profit!

---

The **Fly.io free tier** with an optimized database is your best bet for completely free, production-ready hosting. You get 5GB storage, custom domain, SSL, and it's specifically optimized for SQLite databases!