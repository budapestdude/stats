# Upload Database via GitHub Release

GitHub Releases support files up to 2GB and are fast to download from Railway.

## Step 1: Create GitHub Release

1. Go to your GitHub repo: https://github.com/budapestdude/stats
2. Click **Releases** (right sidebar)
3. Click **Create a new release**
4. Configure:
   - **Tag**: `database-v1`
   - **Title**: Database Release v1
   - **Description**: Railway subset database (500k games)
5. **Attach file**: Drag `otb-database/railway-subset.db` (125MB)
6. Click **Publish release**

GitHub will upload the file (takes 2-5 minutes).

## Step 2: Get Download URL

After release is published:
1. Right-click the database file in the release
2. Click **Copy link address**
3. URL format: `https://github.com/budapestdude/stats/releases/download/database-v1/railway-subset.db`

## Step 3: Update Railway Config

Add environment variable in Railway:
```
DATABASE_DOWNLOAD_URL=https://github.com/budapestdude/stats/releases/download/database-v1/railway-subset.db
```

## Step 4: Deploy

Railway will automatically:
1. Download database on first startup (2-3 minutes)
2. Save to volume
3. Reuse on subsequent deployments

Done! ✅
