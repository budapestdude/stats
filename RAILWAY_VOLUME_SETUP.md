# Railway Volume Setup Guide

Upload the database to Railway using Volumes (persistent storage).

## Step 1: Add Volume to Backend Service

1. Go to **Railway Dashboard** → Your Project
2. Click on your **Backend Service**
3. Go to **Settings** tab
4. Scroll to **Volumes** section
5. Click **+ Add Volume**
6. Configure:
   - **Name**: `chess-database`
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (500MB database + overhead)
7. Click **Add**

Railway will redeploy the service with the volume mounted.

---

## Step 2: Upload Database to Volume

Railway doesn't have a UI for file uploads, so we'll use Railway CLI.

### Install Railway CLI

**Windows (PowerShell):**
```powershell
iwr https://railway.app/install.ps1 | iex
```

**Mac/Linux:**
```bash
npm install -g @railway/cli
```

### Login to Railway

```bash
railway login
```

This opens a browser for authentication.

### Link to Your Project

```bash
railway link
```

Select your project and the **backend service**.

### Upload Database

**Option A: Direct Shell Access**

```bash
railway shell
```

Once inside the Railway shell:
```bash
cd /app/data
# Now you need to upload the file from your local machine
# Railway shell doesn't support direct uploads
exit
```

**Option B: Use SCP via Railway Proxy (Recommended)**

```bash
# Start Railway proxy
railway run bash
```

In another terminal on your computer:
```bash
# Copy database to Railway volume
scp otb-database/railway-subset.db railway:/app/data/railway-subset.db
```

**Option C: Use HTTP Upload Service (Easiest)**

Create a temporary upload endpoint in your server:

1. Add this to `simple-server.js` (temporarily):

```javascript
const multer = require('multer');
const upload = multer({ dest: process.env.RAILWAY_VOLUME_MOUNT_PATH || './uploads/' });

app.post('/admin/upload-db', upload.single('database'), (req, res) => {
  const uploadedPath = req.file.path;
  const targetPath = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || './uploads', 'railway-subset.db');

  fs.renameSync(uploadedPath, targetPath);
  res.json({ success: true, message: 'Database uploaded successfully' });
});
```

2. Deploy to Railway
3. Upload using curl:

```bash
curl -X POST -F "database=@otb-database/railway-subset.db" \
  https://your-backend.railway.app/admin/upload-db
```

4. Remove the upload endpoint after uploading

---

## Step 3: Alternative - Use Railway Volumes UI (Beta)

Railway is testing a web-based file manager:

1. Go to your backend service → **Volumes** tab
2. Click on **chess-database** volume
3. If "Browse Files" button is available, use it to upload

---

## Step 4: Verify Upload

Check if the database is accessible:

```bash
railway run bash
ls -lh /app/data/railway-subset.db
```

You should see:
```
-rw-r--r-- 1 root root 125M railway-subset.db
```

---

## Step 5: Set Environment Variable

Railway should auto-set `RAILWAY_VOLUME_MOUNT_PATH=/app/data`.

Verify in **Variables** tab:
- `RAILWAY_VOLUME_MOUNT_PATH` = `/app/data` (auto-set)

---

## Step 6: Redeploy Service

After upload, redeploy:

```bash
railway up
```

Or trigger a redeploy in Railway dashboard.

---

## Verification

Check logs for:
```
Connected to main database (railway-subset.db with 500k games)
Database contains 500,000 games
```

Test the API:
```bash
curl https://your-backend.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "games": 500000
}
```

---

## Troubleshooting

### "SQLITE_CANTOPEN" error
- Database file not uploaded to volume
- Check file exists: `railway run ls -lh /app/data/`
- Verify permissions: `railway run chmod 644 /app/data/railway-subset.db`

### Volume not mounting
- Check **Settings** → **Volumes** → volume is enabled
- Verify mount path is `/app/data`
- Redeploy service

### Upload fails
- Check Railway CLI is logged in: `railway whoami`
- Ensure linked to correct project: `railway status`
- Try uploading smaller test file first

---

## Database Info

**File**: `railway-subset.db`
**Location on your PC**: `C:\Users\micha\OneDrive\Desktop\Code\Chess Stats\otb-database\railway-subset.db`
**Size**: 125 MB
**Games**: 500,000 OTB tournament games
**Mount Path on Railway**: `/app/data/railway-subset.db`

---

## Quick Reference

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Shell access
railway shell

# Check volume
railway run ls -lh /app/data/

# Redeploy
railway up
```

---

## Next Steps

1. ✅ Add Volume to backend service (1GB, mount at `/app/data`)
2. ✅ Install Railway CLI
3. ✅ Upload `railway-subset.db` to `/app/data/`
4. ✅ Verify file exists on Railway
5. ✅ Redeploy service
6. ✅ Test API endpoints

Database will persist across deployments once uploaded to the volume!
