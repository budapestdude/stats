# Railway Debugging Guide

## Current Issue
Application returns 502 error on Railway - database downloads successfully but SQLite cannot open it.

## Check Deployment Logs

1. **Via Railway Dashboard**:
   - Go to https://railway.app/project/your-project-id
   - Click on your backend service
   - View **Deployments** tab
   - Click latest deployment to see full logs

2. **Look for these log entries**:
   ```
   🔍 Checking for database...
   📥 Downloading database from GitHub Release...
   ✅ Download complete!
   🔍 Database path debug:
   File size: 124.06 MB
   Permissions: [should be 644]
   Access: [should be ✓ Readable and writable]
   Directory: [should be ✓ Writable]
   Opening in READ-WRITE mode
   ```

## Common Issues

### Issue 1: Volume Not Mounted
**Symptom**: `RAILWAY_VOLUME_MOUNT_PATH` is not set
**Fix**: Ensure Railway Volume is created and mounted to service

### Issue 2: Permission Denied
**Symptom**: `Access: ✗ permission denied`
**Fix**: Railway Volume permissions issue - may need to use different directory

### Issue 3: Directory Not Writable
**Symptom**: `Directory: ✗ Not writable`
**Fix**: SQLite needs write access for journal/WAL files - try `/tmp` directory

### Issue 4: File Corruption
**Symptom**: File downloads but has wrong size or hash
**Fix**: Re-download with integrity check

## Potential Solutions

### Solution 1: Copy to /tmp
If volume directory is not writable for SQLite temp files:
```javascript
// In simple-server.js after download
const tmpDbPath = '/tmp/railway-subset.db';
fs.copyFileSync(volumeDbPath, tmpDbPath);
db = new sqlite3.Database(tmpDbPath, sqlite3.OPEN_READONLY);
```

### Solution 2: Use :memory: database
If file system issues persist:
```javascript
// Load database into memory (requires more RAM)
const fileDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
db = new sqlite3.Database(':memory:');
// Use backup API to copy file to memory
```

### Solution 3: Alternative Download Location
Try downloading directly to `/tmp`:
```javascript
const DB_PATH = '/tmp/railway-subset.db';
```

## Next Steps

1. Check Railway deployment logs for permission check output
2. Identify which specific check is failing
3. Apply appropriate solution based on error
4. Redeploy and test
