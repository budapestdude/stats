# Upload Database v3 to Railway - Quick Guide

## ✅ What's Working Now

Your Railway deployment is **LIVE** with:
- ✅ Real tournaments data (103K tournaments from OTB database)
- ✅ Real games data (9.16M games)
- ✅ All endpoints returning actual data
- ✅ 4-tier PGN caching system ready

## 📦 Next Step: Upload Database v3 with PGN Moves

The database chunks are ready in your project root:
- `complete-tournaments.db.part1` (2.0 GB)
- `complete-tournaments.db.part2` (2.0 GB)
- `complete-tournaments.db.part3` (1.9 GB)

### Step 1: Create GitHub Release

1. Go to: https://github.com/budapestdude/stats/releases/new

2. Fill in the form:
   - **Tag**: `database-v3`
   - **Release title**: `Complete OTB Database v3 - With PGN Moves`
   - **Description**:
     ```
     Complete OTB Tournament Database v3 with PGN Moves

     ## Statistics
     - Total games: 9,160,700
     - Games with instant PGN: 4,822,659 (52.65%)
     - Database size: 5.83GB
     - Date range: 1851-2025

     ## What's New in v3
     - 4.8M games now have instant PGN move loading (<1ms)
     - Remaining games use on-demand extraction (10-20s first time, cached after)
     - 4-tier caching system for optimal performance

     ## Files
     This release contains 3 database chunks:
     - complete-tournaments.db.part1 (2.0GB)
     - complete-tournaments.db.part2 (2.0GB)
     - complete-tournaments.db.part3 (1.9GB)

     The download-full-db.js script automatically downloads and assembles these chunks.
     ```

3. Upload the 3 chunk files (drag and drop):
   - `complete-tournaments.db.part1`
   - `complete-tournaments.db.part2`
   - `complete-tournaments.db.part3`

4. Click **"Publish release"**

### Step 2: Update Railway Environment Variable

1. Go to Railway dashboard: https://railway.app/

2. Select your backend project/service

3. Click **"Variables"** tab

4. Find `DATABASE_DOWNLOAD_URL` and update it to:
   ```
   https://github.com/budapestdude/stats/releases/download/database-v3/complete-tournaments.db
   ```

5. **Important**: Add a new variable to force redownload:
   - Variable: `FORCE_REDOWNLOAD`
   - Value: `true`

6. Click **"Deploy"** or trigger a manual redeploy

### Step 3: Monitor Deployment

Watch Railway logs for:

```
🔍 Checking for database...
⚠️  FORCE_REDOWNLOAD enabled - deleting existing database
📥 Downloading 3-part database from GitHub Release...

📦 Downloading chunk 1/3...
   Size: 2048.00 MB
   Progress: 100%

📦 Downloading chunk 2/3...
   Size: 2048.00 MB
   Progress: 100%

📦 Downloading chunk 3/3...
   Size: 1877.68 MB
   Progress: 100%

🔧 Assembling database from chunks...
   Merging chunk 1/3...
   Merging chunk 2/3...
   Merging chunk 3/3...
   ✅ Assembly complete!

🎉 Database ready!
   Final size: 5,973.68 MB
   Total time: 12m 34s
   Location: /app/data/complete-tournaments.db

Server starting on port 3007...
Database connected: 9,160,700 games
4-tier PGN system initialized
```

**Expected download time**: 12-15 minutes

### Step 4: Remove FORCE_REDOWNLOAD (After Successful Deployment)

1. Go back to Railway Variables
2. Delete the `FORCE_REDOWNLOAD` variable (or set to `false`)
3. This prevents redownloading on every deploy

### Step 5: Verify PGN Loading

Test a game endpoint:

```bash
curl "https://stats-production-10e3.up.railway.app/api/games/100000"
```

Look for:
- `"pgn": "1. e4 e5 2. Nf3..."` (actual PGN moves!)
- `"pgnSource": "database"` or `"pgnSource": "cache"`

### Step 6: Test Frontend

Visit your frontend and verify:
1. **Tournaments page**: Shows real tournaments ✅
2. **Games page**: Shows real games ✅
3. **Game viewer**: Displays PGN moves and board ✅

---

## 🎉 What You'll Have After This

- **9.16M games** in database
- **4.8M games** with instant PGN loading (<1ms)
- **Real tournaments** from 103K historical events
- **Real games** with actual player names and dates
- **4-tier caching**: Most games load instantly, rest cached after first view

---

## 📊 Performance Expectations

| Game Type | First Load | Subsequent |
|-----------|------------|------------|
| **With PGN in DB** (4.8M) | <1ms | <1ms |
| **Cached** (10K most recent) | <1ms | <1ms |
| **On-demand extraction** | 10-20s | <1ms |

---

## 🔧 Troubleshooting

### Download Fails

Check Railway logs for errors. If chunks fail to download:
- Verify release is public: https://github.com/budapestdude/stats/releases/tag/database-v3
- Try downloading one chunk manually to test
- Check Railway volume has enough space (need 12GB during assembly)

### Database Not Loading

If PGN still shows null:
- Check Railway logs that download completed
- Verify file size is ~5.97GB
- Restart deployment if needed
- Check `FORCE_REDOWNLOAD` was set correctly

### Still Shows Old Data

- Clear Railway cache: Settings → Clear Build Cache
- Force redeploy
- Check `DATABASE_DOWNLOAD_URL` points to v3

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] GitHub Release `database-v3` exists with 3 chunks
- [ ] Railway `DATABASE_DOWNLOAD_URL` points to v3
- [ ] Railway logs show successful download (5.97GB)
- [ ] Railway logs show "4-tier PGN system initialized"
- [ ] `/api/games/100000` returns PGN moves
- [ ] Tournaments page shows real data
- [ ] Games page shows real data with PGN

---

## 📞 Current Status

**✅ Code deployed** - All endpoints working with real data
**📦 Database ready** - 3 chunks created (5.83GB)
**⏳ Next step** - Upload chunks to GitHub Release

Once you complete Steps 1-2 above, Railway will automatically download and deploy the v3 database with 4.8M instant PGN games!
