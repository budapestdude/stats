# Re-Upload Database v3 with PGN Moves Column

## Issue Found

The database chunks uploaded to GitHub Release `database-v3` were missing the `pgn_moves` column, causing Railway to fail with:
```
SQLITE_ERROR: no such column: pgn_moves
```

## Solution: Replace the chunks with updated database

The database was split again (October 14) with the `pgn_moves` column populated (4.8M games with instant PGN).

---

## Steps to Re-Upload

### 1. Verify New Chunks Are Ready

After running `node split-db-v3.js`, verify these files exist in the project root:

```bash
ls -lh complete-tournaments.db.part*
```

Should show:
- `complete-tournaments.db.part1` (~2.0 GB)
- `complete-tournaments.db.part2` (~2.0 GB)
- `complete-tournaments.db.part3` (~1.9 GB)

### 2. Delete Old Assets from GitHub Release

1. Go to: https://github.com/budapestdude/stats/releases/tag/database-v3
2. Click **"Edit release"**
3. **Delete** the 3 old chunk files:
   - complete-tournaments.db.part1 (old)
   - complete-tournaments.db.part2 (old)
   - complete-tournaments.db.part3 (old)
4. Don't click "Update release" yet

### 3. Upload New Chunks

1. Still on the edit page, drag and drop the 3 new chunks:
   - `complete-tournaments.db.part1` (new - Oct 14)
   - `complete-tournaments.db.part2` (new - Oct 14)
   - `complete-tournaments.db.part3` (new - Oct 14)

2. Wait for all 3 to upload (this will take 10-15 minutes)

3. Click **"Update release"**

### 4. Force Railway to Re-Download

Railway cached the database, so we need to force a redownload:

1. Go to Railway dashboard: https://railway.app/
2. Select your backend service
3. Click **"Variables"** tab
4. Add a new variable:
   - Name: `FORCE_REDOWNLOAD`
   - Value: `true`
5. Click **"Deploy"** or trigger a manual redeploy

### 5. Monitor Railway Logs

Watch the deployment logs for:

```
🔍 Checking for database...
⚠️  FORCE_REDOWNLOAD enabled - deleting existing database
📥 Downloading 3-part database from GitHub Release...

📦 Downloading chunk 1/3...
   Progress: 100%

📦 Downloading chunk 2/3...
   Progress: 100%

📦 Downloading chunk 3/3...
   Progress: 100%

🔧 Assembling database from chunks...
   ✅ Assembly complete!

🎉 Database ready!
   Final size: 5973.68 MB

Server starting on port 3007...
✅ Connected to main database (railway-subset.db with 500k games)
   Database ready for queries
```

**Expected time**: 12-15 minutes for download + assembly

### 6. Verify Database Has PGN Column

Test the games endpoint:

```bash
curl "https://stats-production-10e3.up.railway.app/api/games/100"
```

Should return a game object WITHOUT the error:
```
{"error":"SQLITE_ERROR: no such column: pgn_moves"}
```

### 7. Remove FORCE_REDOWNLOAD Variable

After successful deployment:

1. Go back to Railway Variables
2. **Delete** the `FORCE_REDOWNLOAD` variable
3. This prevents unnecessary redownloads on future deploys

---

## What's Different in the New Chunks?

The new database chunks include:

✅ **`pgn_moves` column** added to games table
✅ **4,822,659 games** (52.65%) have PGN moves populated
✅ **Instant loading** for 4.8M games (<1ms)
✅ **4-tier caching system** ready to use
✅ **Total size**: 5.83 GB (same as before)

---

## Verification Checklist

After re-uploading and redeploying:

- [ ] New chunks uploaded to GitHub Release database-v3
- [ ] Railway `FORCE_REDOWNLOAD` set to `true`
- [ ] Railway redeployment triggered
- [ ] Database downloaded successfully (5.97GB)
- [ ] Server started without SQLITE_CANTOPEN error
- [ ] `/api/games/100` returns game data (not "no such column" error)
- [ ] Tournaments page shows real data
- [ ] Games page loads without errors
- [ ] `FORCE_REDOWNLOAD` variable removed

---

## Timeline

| Step | Duration |
|------|----------|
| Split database | 2-3 minutes (completed) |
| Upload chunks to GitHub | 10-15 minutes |
| Railway download | 10-15 minutes |
| Total | ~25-35 minutes |

---

## Current Status

✅ **Database split complete** - Fresh chunks created with pgn_moves column
⏳ **Next step** - Delete old chunks from GitHub Release and upload new ones
