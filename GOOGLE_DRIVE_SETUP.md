# Deploy Database via Google Drive

## Overview
Upload the 5.1GB database to Google Drive once, then Railway downloads it on first deployment.

## Setup Steps

### 1. Upload Database to Google Drive

1. Go to [Google Drive](https://drive.google.com)
2. Upload `otb-database/complete-tournaments.db` (5.1GB)
   - This will take 10-30 minutes depending on upload speed
3. Once uploaded, right-click the file → **Get link**
4. Set sharing to **Anyone with the link** (required for Railway to download)
5. Copy the share link

### 2. Extract File ID from Share Link

Google Drive link format:
```
https://drive.google.com/file/d/FILE_ID_HERE/view?usp=sharing
```

**Extract the FILE_ID** from between `/d/` and `/view`

Example:
- Link: `https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J/view?usp=sharing`
- File ID: `1a2B3c4D5e6F7g8H9i0J`

### 3. Configure Railway Environment Variable

1. Go to Railway dashboard
2. Select your backend service
3. Go to **Variables** tab
4. Add new variable:
   ```
   GOOGLE_DRIVE_FILE_ID=YOUR_FILE_ID_HERE
   ```
5. Click **Add** and redeploy

### 4. Deploy to Railway

Push code to GitHub:
```bash
git add download-database.js railway.json GOOGLE_DRIVE_SETUP.md
git commit -m "Add Google Drive database download for Railway"
git push
```

Railway will:
1. Start deployment
2. Run `download-database.js`
3. Download database from Google Drive (~3-10 minutes)
4. Start server with full 9.1M game database

## How It Works

### download-database.js
- Checks if database already exists (skip download on restarts)
- Downloads from Google Drive using direct download link
- Shows progress (%, speed, time elapsed)
- Falls back to subset database if download fails

### First Deployment
```
🔍 Checking for database...
📥 Downloading database from Google Drive...
   File ID: 1a2B3c4D5e6F7g8H9i0J
   Total size: 5133.75 MB
   Downloading...

   Progress: 45.2% (2320.45 MB / 5133.75 MB) - 12.5 MB/s - 3m 5s elapsed

✅ Download complete!
   Size: 5133.75 MB
   Time: 6m 51s
   Location: otb-database/complete-tournaments.db

🎉 Database ready for use!
🚀 Chess Stats API Server starting...
```

### Subsequent Deployments
```
🔍 Checking for database...
✅ Database already exists (5133.75 MB)
   Skipping download.

🚀 Chess Stats API Server starting...
```

## Database Persistence

### With Railway Volume (Recommended)
Add a volume to persist database across deployments:

1. Railway service → **Settings** → **Volumes**
2. Add volume:
   - Name: `chess-database`
   - Mount Path: `/app/otb-database`
   - Size: 10GB
3. Database downloads once, persists forever

### Without Volume
Database downloads on every deployment (6-10 minutes each time).

## Advantages

✅ **No Git LFS limits** - Google Drive handles large files easily
✅ **Free hosting** - Google Drive free tier: 15GB
✅ **Fast downloads** - Google CDN is fast
✅ **One-time upload** - Upload once, deploy unlimited times
✅ **No code changes** - Works with existing server code
✅ **Fallback support** - Falls back to subset if download fails

## Troubleshooting

### Download Fails: "Not Found"
- Check file sharing is set to **Anyone with the link**
- Verify File ID is correct
- Test link in browser: `https://drive.google.com/uc?export=download&id=FILE_ID`

### Download Fails: "Rate Limited"
- Google Drive has download quotas
- Wait 24 hours and redeploy
- Or use different Google account

### Railway Times Out
- Railway has deployment timeout (~10 minutes)
- Use Railway Volume to persist database
- Or upgrade Railway plan for longer timeouts

### Database Corrupted
- Download might have been interrupted
- Delete database in Railway and redeploy
- Check Google Drive file integrity

## Alternative: Direct URL

If you have the database hosted elsewhere (S3, DigitalOcean Spaces, etc.):

1. Set environment variable:
   ```
   DATABASE_DOWNLOAD_URL=https://your-cdn.com/complete-tournaments.db
   ```

2. Update `download-database.js` to use this URL instead

## Cost Comparison

### Google Drive
- **Upload**: Free
- **Storage**: Free (within 15GB limit)
- **Downloads**: Free (with quotas)
- **Total**: $0/month

### Railway Volume
- **Storage**: ~$0.25/GB/month × 6GB = $1.50/month
- **Persistence**: Database persists across deployments
- **Total**: $1.50/month

### Recommended Setup
- Upload to Google Drive (free)
- Add Railway Volume (persist database)
- Download once, use forever
- **Total cost**: $1.50/month

## Database Info

**File**: `complete-tournaments.db`
**Size**: 5.1GB (5,382,627,328 bytes)
**Games**: 9,144,267 OTB tournament games
**Upload time**: 10-30 minutes (one-time)
**Download time**: 3-10 minutes (first deployment only with volume)

## Next Steps

1. ✅ Upload database to Google Drive
2. ✅ Get File ID from share link
3. ✅ Add GOOGLE_DRIVE_FILE_ID to Railway
4. ✅ Push code to GitHub
5. ✅ Deploy to Railway
6. ✅ Monitor logs for download progress
7. ✅ Test API with full database

---

**Status**: Ready to deploy! Just need to upload database to Google Drive and configure Railway environment variable.
