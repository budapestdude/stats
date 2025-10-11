# Full Database Upload to GitHub Release (5.1GB, 9.1M games)

## Database Split Complete! ✅

The 5.1GB `complete-tournaments.db` has been split into 3 chunks:
- `complete-tournaments.db.part1` - 1.9GB
- `complete-tournaments.db.part2` - 1.9GB
- `complete-tournaments.db.part3` - 1.4GB

Location: `database-chunks/`

---

## Step 1: Create GitHub Release

1. Go to https://github.com/budapestdude/stats/releases
2. Click **"Draft a new release"**
3. Configure the release:
   - **Tag**: `database-v2`
   - **Title**: `Full Database Release v2 (9.1M games)`
   - **Description**:
     ```
     Full OTB tournament database with 9.1 million games (5.1GB)

     Database is split into 3 chunks for GitHub's 2GB limit:
     - complete-tournaments.db.part1 (1.9GB)
     - complete-tournaments.db.part2 (1.9GB)
     - complete-tournaments.db.part3 (1.4GB)

     Railway deployment will automatically download and reassemble these chunks.
     ```

4. **DO NOT publish yet** - first attach the files

---

## Step 2: Upload Database Chunks

### Option A: Via Web Interface (Recommended)

1. In the draft release, scroll to **"Attach binaries"**
2. Drag and drop all 3 files from `database-chunks/` folder:
   - `complete-tournaments.db.part1`
   - `complete-tournaments.db.part2`
   - `complete-tournaments.db.part3`

3. Wait for uploads to complete (10-20 minutes total)
   - Part 1: ~5-8 minutes
   - Part 2: ~5-8 minutes
   - Part 3: ~3-5 minutes

4. Verify all 3 files appear in the release

5. Click **"Publish release"**

### Option B: Via GitHub CLI (If installed)

```bash
# Create release
gh release create database-v2 \
  --title "Full Database Release v2 (9.1M games)" \
  --notes "Full OTB tournament database with 9.1 million games (5.1GB). Split into 3 chunks." \
  database-chunks/complete-tournaments.db.part*

# This will upload all chunks automatically
```

---

## Step 3: Get Download URLs

After publishing the release:

1. Go to https://github.com/budapestdude/stats/releases/tag/database-v2
2. Right-click on each chunk file and copy link address
3. URLs should be:
   ```
   https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part1
   https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part2
   https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part3
   ```

---

## Step 4: Update Railway Configuration

### A. Update Environment Variables

In Railway **backend service** settings, update:

| Variable | New Value |
|----------|-----------|
| `DATABASE_DOWNLOAD_URL` | `https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db` |
| `DATABASE_CHUNK_COUNT` | `3` |
| `FORCE_REDOWNLOAD` | `true` (temporary - remove after first successful download) |

### B. Update railway.json

The backend's `railway.json` needs to use the new download script:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "node download-full-db.js && node simple-server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Changes needed:**
- Change from `download-db-from-url.js` to `download-full-db.js`
- This will be done automatically when you commit

---

## Step 5: Update simple-server.js Database Path

The server needs to look for the full database instead of the subset:

```javascript
// In simple-server.js, update database path priority:
const volumeDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'complete-tournaments.db')  // Changed from 'railway-subset.db'
  : null;
```

This will be updated automatically when you commit.

---

## Step 6: Deploy to Railway

After committing the changes:

1. Railway will automatically detect the new code
2. Download script will run:
   - Download chunk 1 (1.9GB) - ~3-5 minutes
   - Download chunk 2 (1.9GB) - ~3-5 minutes
   - Download chunk 3 (1.4GB) - ~2-3 minutes
   - Assemble database (5.1GB) - ~1-2 minutes
3. Total deployment time: **~10-15 minutes**

### Monitor Progress

Watch Railway logs to see:
```
📦 Downloading chunk 1/3...
   Size: 1900.00 MB
   Progress: 100% (1900.00 MB / 1900.00 MB) - 8.50 MB/s
   ✅ Chunk 1 complete

📦 Downloading chunk 2/3...
   ...

🔧 Assembling database from chunks...
   Merging chunk 1/3...
   Merging chunk 2/3...
   Merging chunk 3/3...
   ✅ Assembly complete!

🎉 Database ready!
   Final size: 5010.00 MB
   Total time: 12m 34s
   Location: /app/data/complete-tournaments.db
```

---

## Step 7: Verify Deployment

After deployment completes:

```bash
# Check backend health
curl https://stats-production-10e3.up.railway.app/health

# Test database query
curl "https://stats-production-10e3.up.railway.app/api/otb/database/players/search?q=carlsen"

# Should return Magnus Carlsen with all his games
```

---

## Expected Storage Usage

### Railway Volume
- Database: 5.1GB
- Temp chunks during download: ~5.1GB (deleted after assembly)
- Peak usage during download: ~10.2GB
- Final usage: ~5.1GB

### Railway Plan Requirements
- **Pro Plan** minimum (50GB volume included)
- Volume usage: 5.1GB / 50GB (10%)
- Download bandwidth: ~5.1GB per deployment (free)

---

## Troubleshooting

### Issue: Upload to GitHub fails
**Solution**: Make sure each chunk is under 2GB:
```bash
ls -lh database-chunks/
# All files should be < 2GB
```

### Issue: Railway runs out of disk space
**Solution**:
- Ensure you're on Pro plan (50GB volume)
- Check volume usage in Railway dashboard
- If full, consider using smaller database or upgrading volume

### Issue: Download times out
**Solution**:
- Railway deployment timeout is 30 minutes (should be enough)
- If timeout occurs, increase chunk size to reduce download time
- Or reduce total database size

### Issue: Assembly fails
**Solution**:
- Check Railway logs for specific error
- Ensure all 3 chunks downloaded successfully
- Verify chunk integrity (check file sizes)

---

## Rollback Plan

If full database deployment fails, you can rollback:

1. In Railway, set `DATABASE_DOWNLOAD_URL` back to:
   ```
   https://github.com/budapestdude/stats/releases/download/database-v1/railway-subset.db
   ```

2. Remove `DATABASE_CHUNK_COUNT` variable

3. Redeploy - will use 500k game subset (124MB)

---

## Database Comparison

| Database | Games | Size | Download Time | Storage |
|----------|-------|------|---------------|---------|
| Subset (v1) | 500k | 124MB | 30 seconds | 124MB |
| **Full (v2)** | **9.1M** | **5.1GB** | **10-15 min** | **5.1GB** |

---

## Files Created

1. `split-database.js` - Splits large DB into chunks
2. `download-full-db.js` - Downloads and reassembles chunks
3. `database-chunks/complete-tournaments.db.part*` - The 3 chunk files
4. `FULL_DATABASE_UPLOAD.md` - This guide

---

## Next Steps After This Guide

Once you've completed the GitHub Release upload:

1. ✅ Commit the new scripts to git
2. ✅ Update Railway environment variables
3. ✅ Wait for automatic deployment
4. ✅ Verify 9.1M games are loaded
5. ✅ Test frontend with full database
6. ✅ Remove `FORCE_REDOWNLOAD` variable

---

**Ready to proceed?** Upload the chunks to GitHub Release (Step 2), then run the commit command below!
