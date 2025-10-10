# Deploy 5GB Database on Railway

## Problem
The `complete-tournaments.db` file is **5GB** - too large for Railway deployment.

## Solution: Railway Volumes + Manual Upload

Railway Volumes provide persistent storage separate from deployments.

---

## Option 1: Railway Volume (Recommended)

### Step 1: Add Volume to Backend Service

1. Go to Railway dashboard
2. Select your **backend service**
3. Go to **Settings** tab
4. Scroll to **Volumes** section
5. Click **+ Add Volume**
6. Configure:
   ```
   Name: chess-database
   Mount Path: /app/data
   Size: 10GB (or more if you have Pro plan)
   ```
7. Click **Add**

### Step 2: Update Backend Code

Update `simple-server.js` to use volume path:

```javascript
// Use Railway volume path if available, otherwise local
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'complete-tournaments.db')
  : path.join(__dirname, 'otb-database', 'complete-tournaments.db');
```

### Step 3: Upload Database to Volume

Railway doesn't have built-in UI for file uploads. Use Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Copy database to volume
railway run bash

# Inside Railway shell:
cd /app/data
# Now use SCP or upload method to transfer database
```

### Alternative: Use S3/Object Storage

Since Railway CLI upload is limited, use cloud storage:

1. Upload database to S3/DigitalOcean Spaces/etc
2. Download in Railway startup:

```javascript
// In simple-server.js
const downloadDatabase = async () => {
  if (!fs.existsSync(dbPath)) {
    console.log('Downloading database from cloud storage...');
    // Download from S3/DO Spaces
    await fetch('https://your-storage-url.com/complete-tournaments.db')
      .then(res => res.arrayBuffer())
      .then(buffer => fs.writeFileSync(dbPath, Buffer.from(buffer)));
  }
};
```

---

## Option 2: Migrate to Railway PostgreSQL (Better for Production)

Railway offers managed PostgreSQL with better performance for large datasets.

### Benefits
- ✅ No file size limits
- ✅ Better query performance
- ✅ Automatic backups
- ✅ Scaling
- ✅ Better for concurrent users

### Steps

#### 1. Add PostgreSQL Service

1. Railway dashboard → Your project
2. Click **+ New**
3. Select **Database** → **Add PostgreSQL**
4. Railway creates and connects the database

#### 2. Get Connection String

Railway automatically provides environment variables:
```
DATABASE_URL=postgresql://user:pass@host:port/db
```

#### 3. Migrate SQLite to PostgreSQL

I'll create a migration script for you:

```javascript
// migrate-to-postgres.js
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

const sqliteDb = new sqlite3.Database('otb-database/complete-tournaments.db');
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await pgClient.connect();

  // Create tables
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      white_player TEXT,
      black_player TEXT,
      result TEXT,
      date TEXT,
      eco TEXT,
      opening TEXT,
      moves TEXT,
      white_rating INTEGER,
      black_rating INTEGER,
      tournament TEXT
    );
    CREATE INDEX idx_white_player ON games(white_player);
    CREATE INDEX idx_black_player ON games(black_player);
    CREATE INDEX idx_eco ON games(eco);
  `);

  // Migrate data in batches
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const rows = await new Promise((resolve, reject) => {
      sqliteDb.all(
        `SELECT * FROM games LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
        (err, rows) => err ? reject(err) : resolve(rows)
      );
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      await pgClient.query(
        `INSERT INTO games (white_player, black_player, result, date, eco, opening, moves, white_rating, black_rating, tournament)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [row.white_player, row.black_player, row.result, row.date, row.eco, row.opening, row.moves, row.white_rating, row.black_rating, row.tournament]
      );
    }

    offset += BATCH_SIZE;
    console.log(`Migrated ${offset} rows...`);
  }

  console.log('Migration complete!');
  await pgClient.end();
  sqliteDb.close();
}

migrate().catch(console.error);
```

#### 4. Update Application Code

Replace SQLite with PostgreSQL queries:

```javascript
// Before (SQLite)
db.get('SELECT * FROM games WHERE id = ?', [id], callback);

// After (PostgreSQL)
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const result = await client.query('SELECT * FROM games WHERE id = $1', [id]);
```

---

## Option 3: Use Smaller Database (Quick Solution)

Create a subset database with recent games only:

```bash
# Create smaller database with 100k games
sqlite3 otb-database/complete-tournaments.db

# Export recent games
.output subset.sql
SELECT * FROM games
WHERE date >= '2020-01-01'
LIMIT 100000;
.quit

# Create new database
sqlite3 otb-database/subset.db < subset.sql
```

Then update code to use `subset.db` instead.

---

## Recommended Approach

**For Railway deployment, I recommend:**

1. **Short term**: Use smaller subset database (Option 3)
2. **Long term**: Migrate to Railway PostgreSQL (Option 2)

PostgreSQL is better for:
- Large datasets
- Multiple concurrent users
- Production workloads
- Managed backups
- Better performance

---

## Implementation Plan

### Immediate (Deploy Now)
```bash
# Create smaller database
cd otb-database
sqlite3 complete-tournaments.db "CREATE TABLE games_subset AS SELECT * FROM games ORDER BY date DESC LIMIT 100000;"
sqlite3 subset.db < games_subset.sql
```

Update code:
```javascript
const dbPath = path.join(__dirname, 'otb-database', 'subset.db');
```

### Future (Production Ready)
1. Add Railway PostgreSQL
2. Run migration script
3. Update queries to use PostgreSQL
4. Deploy with managed database

---

## Cost Comparison

### SQLite + Railway Volume
- Volume: $10/month for 10GB (Pro plan)
- Ephemeral (data persists but limited scaling)

### Railway PostgreSQL
- Free tier: 512MB storage
- Starter: $5/month for 1GB
- Pro: $25/month for 8GB
- Better performance, backups, scaling

For 5GB database → PostgreSQL Pro plan recommended.

---

## Next Steps

Choose your approach:

**A) Quick Deploy (Subset)**
1. Create smaller database
2. Update code to use subset
3. Deploy to Railway
4. Works immediately

**B) Production Ready (PostgreSQL)**
1. Add Railway PostgreSQL service
2. Run migration script
3. Update application code
4. Better long-term solution

Which would you prefer?
