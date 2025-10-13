# Railway Deployment Guide - Database v3 (with PGN Moves)

## Overview

This guide deploys the **updated database with 4.8M games having instant PGN moves** to Railway.

### What's New in v3

- **Database size**: 5.83GB (up from 5.1GB)
- **PGN coverage**: 52.65% of games (4.8M) have instant PGN loading
- **4-Tier caching system**: Database → Cache → chess-stats.db → File extraction
- **User experience**: Most games load instantly, rare games extract on-demand

---

## Step 1: Split Database into Chunks ✅

**Status**: Running

```bash
node split-db-v3.js
```

This creates 3 files:
- `complete-tournaments.db.part1` (~2GB)
- `complete-tournaments.db.part2` (~2GB)
- `complete-tournaments.db.part3` (~1.83GB)

---

## Step 2: Create GitHub Release

1. Go to: https://github.com/budapestdude/stats/releases
2. Click "Draft a new release"
3. **Tag version**: `database-v3`
4. **Release title**: "Complete OTB Database v3 - With PGN Moves"
5. **Description**:
   ```
   Complete OTB Tournament Database v3 with PGN Moves

   ## Database Statistics
   - Total games: 9,160,700
   - Games with instant PGN: 4,822,659 (52.65%)
   - Database size: 5.83GB
   - Date range: 1851-2025

   ## What's New
   - 4.8M games now have instant PGN move loading (<1ms)
   - Remaining games use on-demand extraction (10-20s first time, cached after)
   - 4-tier caching system for optimal performance

   ## Files
   This release contains the database split into 3 parts:
   - complete-tournaments.db.part1 (2GB)
   - complete-tournaments.db.part2 (2GB)
   - complete-tournaments.db.part3 (1.83GB)

   ## Usage
   The download-full-db.js script automatically downloads and assembles these chunks.
   ```

6. Upload all 3 chunk files
7. Publish release

---

## Step 3: Update Railway Environment Variable

In Railway dashboard:
1. Go to your backend service
2. Click "Variables" tab
3. Update `DATABASE_DOWNLOAD_URL` to:
   ```
   https://github.com/budapestdude/stats/releases/download/database-v3/complete-tournaments.db
   ```
4. Save changes (don't redeploy yet)

---

## Step 4: Push Updated Code

The code already supports v3 - just push to trigger redeployment:

```bash
# Commit any pending changes
git add .
git commit -m "Deploy database v3 with 4.8M instant PGN games"

# Push to trigger Railway redeployment
git push origin master
```

Railway will automatically:
1. Detect the push
2. Build the new image
3. Run `download-full-db.js` with new URL
4. Download and assemble v3 database
5. Start server with updated database

---

## Step 5: Monitor Deployment

### Railway Logs

Watch for these key messages:

```
🔍 Checking for database...
📥 Downloading 3-part database from GitHub Release...
📦 Downloading chunk 1/3...
📦 Downloading chunk 2/3...
📦 Downloading chunk 3/3...
🔧 Assembling database from chunks...
🎉 Database ready!
   Final size: 5,973.68 MB
   Location: /app/data/complete-tournaments.db

Server starting on port 3007...
Database connected: 9,160,700 games
4-tier PGN system initialized
```

### Expected Timeline

- **Code push → Build**: ~60 seconds
- **Database download**: ~10-15 minutes (3 chunks × ~2GB each)
- **Assembly**: ~30 seconds
- **Total deployment**: ~12-16 minutes

---

## Step 6: Verify Deployment

### Test Endpoints

1. **Health check**:
   ```bash
   curl https://stats-production-10e3.up.railway.app/health
   ```

2. **Database stats**:
   ```bash
   curl https://stats-production-10e3.up.railway.app/api/stats/overview
   ```
   Should show: `"totalGames": 9160700`

3. **Player with PGN** (Magnus Carlsen):
   ```bash
   curl https://stats-production-10e3.up.railway.app/api/players/magnus-carlsen/stats
   ```
   Should show complete stats with opening data

4. **Game with PGN moves**:
   ```bash
   curl https://stats-production-10e3.up.railway.app/api/games/1
   ```
   Should include `pgn_moves` field or extraction source

### Test Frontend

1. Visit: https://invigorating-solace-production.up.railway.app
2. Go to Magnus Carlsen profile: `/players/magnus-carlsen`
3. Check all tabs load:
   - Overview ✅
   - Yearly Progress ✅
   - Openings ✅ (should show 15+ openings)
   - Opponents ✅ (top 20 opponents)

4. Test game loading:
   - Go to `/games`
   - Search for a game
   - Click to view details
   - Verify PGN moves display

---

## Troubleshooting

### Database Download Fails

**Symptoms**: Logs show download errors

**Solutions**:
1. Verify GitHub Release URL is correct
2. Check all 3 chunks uploaded successfully
3. Verify chunks are publicly accessible
4. Try manual download test:
   ```bash
   curl -L https://github.com/budapestdude/stats/releases/download/database-v3/complete-tournaments.db.part1 -o test.part1
   ```

### Database Assembly Fails

**Symptoms**: Download succeeds but assembly errors

**Solutions**:
1. Check Railway volume has enough space (need ~12GB during assembly)
2. Verify all chunks downloaded completely
3. Check Railway logs for specific error messages

### PGN Moves Not Loading

**Symptoms**: Games show but no PGN moves

**Solutions**:
1. Verify database updated (check file size: should be 5.83GB)
2. Check server logs for PGN extraction attempts
3. Test a known game with PGN in database:
   ```bash
   curl https://stats-production-10e3.up.railway.app/api/games/100000
   ```

### Slow Performance

**Symptoms**: API responses taking >1 second

**Solutions**:
1. Check database indexes present:
   ```bash
   curl https://stats-production-10e3.up.railway.app/api/debug/indexes
   ```
2. Verify cache is working (check logs for cache hits)
3. Monitor Railway metrics for CPU/memory issues

---

## Performance Metrics

### Expected Response Times

| Endpoint | Expected Time |
|----------|---------------|
| Health check | <50ms |
| Database stats | <100ms |
| Player stats | 100-300ms |
| Top opponents | 200-400ms |
| Openings list | 50-100ms |
| **Game with cached PGN** | **<50ms** ⚡ |
| Game with on-demand extraction | 10-20s (first time only) |

### PGN Loading Performance

| Game Type | First Load | Subsequent Loads |
|-----------|------------|------------------|
| **Database PGN** (4.8M games) | **<1ms** ⚡⚡⚡ | <1ms |
| **Cached** (10k most recent) | <1ms | <1ms |
| **chess-stats.db** (105k games) | <50ms | <1ms (cached) |
| **On-demand extraction** | 10-20s | <1ms (cached) |

---

## Rollback Plan

If v3 deployment fails, rollback to v2:

1. Update Railway environment variable:
   ```
   DATABASE_DOWNLOAD_URL=https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db
   ```

2. Force redownload:
   ```
   FORCE_REDOWNLOAD=true
   ```

3. Trigger redeploy in Railway dashboard

---

## Success Checklist

- [ ] Database split complete (3 chunks created)
- [ ] GitHub Release database-v3 created
- [ ] All 3 chunks uploaded to release
- [ ] Railway DATABASE_DOWNLOAD_URL updated
- [ ] Code pushed to trigger redeployment
- [ ] Railway logs show successful database download
- [ ] Database assembled successfully (5.83GB)
- [ ] Server started successfully
- [ ] Health endpoint responds
- [ ] Database stats show 9.16M games
- [ ] Magnus Carlsen profile loads with all tabs
- [ ] Openings tab shows 15+ openings
- [ ] Game PGN loading works
- [ ] Frontend displays correctly

---

## Post-Deployment

### Update Documentation

Update `RAILWAY_DEPLOYMENT_STATUS.md`:
- Database version: v3
- PGN coverage: 52.65% (4.8M games)
- 4-tier system: Active
- Performance: Document actual response times

### Monitor for 24 Hours

Watch for:
- Memory usage (should be similar to v2)
- API response times (should be faster for most games)
- Error rates (should be low)
- User reports of issues

### Optional: Run Solution 3 Again

If you want 100% coverage in the future:
1. Run `add-pgn-moves-to-db.js` again on remaining games
2. This would process another ~4.3M games
3. Database would grow to ~8-9GB
4. All games would have instant PGN (<1ms)

---

## Support

If issues arise:
1. Check Railway logs first
2. Test endpoints manually with curl
3. Verify database file size and integrity
4. Check GitHub Release is accessible
5. Review error messages in logs

**Current Status**: ✅ Ready for deployment
**Next Step**: Upload chunks to GitHub Release (database-v3)
