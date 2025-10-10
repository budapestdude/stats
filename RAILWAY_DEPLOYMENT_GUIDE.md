# Railway Deployment Guide - Full Stack

## Overview
Deploy both frontend (Next.js) and backend (Node.js/Express) on Railway.

## Architecture
- **Frontend Service**: Next.js app (already deployed)
- **Backend Service**: Node.js Express API (new)
- **Communication**: Frontend → Backend (internal Railway networking)

---

## Step 1: Create Backend Service on Railway

### Option A: Via Railway Dashboard (Recommended)

1. Go to your Railway project
2. Click **+ New Service**
3. Select **GitHub Repo**
4. Choose your `stats` repository
5. Railway will detect `package.json` and auto-configure

### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Create new service
railway up
```

---

## Step 2: Configure Backend Service

### Environment Variables

In Railway dashboard → Backend Service → Variables:

```
# Port (Railway provides this automatically, but you can verify)
PORT=3007

# Node Environment
NODE_ENV=production

# Optional: Custom variables
CHESS_COM_USER_AGENT=Chess-Stats-Website/1.0
```

### Build Settings

Railway should auto-detect from `railway.json`:
- **Build Command**: `npm install`
- **Start Command**: `node simple-server.js`

If not, set manually:
1. Go to **Settings** tab
2. **Build**: `npm install`
3. **Start Command**: `node simple-server.js`

### Root Directory

If your backend is in root:
- **Root Directory**: `/` (default)

---

## Step 3: Get Backend Service URL

After deployment completes:

1. Go to **Settings** tab
2. Under **Networking**, find the public URL
3. Copy the URL (e.g., `https://chess-stats-backend-production.up.railway.app`)

Or click **Generate Domain** if not auto-generated.

---

## Step 4: Update Frontend Environment Variable

Go to Frontend Service → Variables:

### Update/Add Variable
```
NEXT_PUBLIC_API_URL=https://your-backend-service.up.railway.app
```

**Replace** `your-backend-service` with your actual backend URL from Step 3.

### Example
```
NEXT_PUBLIC_API_URL=https://chess-stats-backend-production.up.railway.app
```

---

## Step 5: Update Frontend Config (Optional)

Update `frontend/lib/config.ts` to use environment variable:

```typescript
const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3007';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3007';
    }

    // Production - use environment variable
    return BUILD_TIME_API_URL;
  }

  return BUILD_TIME_API_URL;
}
```

This is already configured correctly in your repo.

---

## Step 6: Redeploy Frontend

After updating environment variables:

1. Railway should auto-redeploy
2. If not, manually trigger:
   - Go to **Deployments** tab
   - Click **Deploy**

Or via CLI:
```bash
railway up
```

---

## Step 7: Verify Deployment

### Test Backend
Visit your backend URL:
```
https://your-backend-service.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-04T...",
  "message": "Chess Stats API is running!"
}
```

### Test API Endpoint
```
https://your-backend-service.up.railway.app/api/players/magnuscarlsen
```

Should return player data.

### Test Frontend
1. Visit your frontend URL
2. Open DevTools (F12) → Console
3. Should see:
   ```
   [Config] API URL Configuration:
     Selected API URL: https://your-backend-service.up.railway.app
   ```
4. Navigate to `/players` or `/` - data should load
5. No mixed content errors!

---

## Important Notes

### Database Handling

Railway services are ephemeral. For SQLite database:

**Option 1: Use Railway Volume (Recommended)**
```bash
# In Railway dashboard → Backend Service → Settings
# Add Persistent Volume
# Mount point: /app/otb-database
```

**Option 2: Use smaller database**
The complete-tournaments.db (9.1M games) might be too large.
Consider using a smaller subset or migrating to PostgreSQL.

**Option 3: PostgreSQL Migration**
Railway offers PostgreSQL plugin:
1. Add PostgreSQL service to project
2. Migrate SQLite data to PostgreSQL
3. Update code to use PostgreSQL

### File Upload Limits

Railway has deployment size limits:
- Free tier: 100MB uncompressed
- Pro tier: 500MB uncompressed

Your `otb-database/complete-tournaments.db` may exceed this.

**Solutions:**
1. **Exclude large files** - Add to `.slugignore`:
   ```
   otb-database/complete-tournaments.db
   otb-database/pgn-files/
   ```

2. **Use external storage** - Upload database to S3/DO Spaces

3. **Use Railway PostgreSQL** - Migrate to managed database

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
railway logs --service backend
```

Common issues:
- Missing dependencies: Run `npm install`
- Wrong start command: Should be `node simple-server.js`
- Port binding: Ensure using `process.env.PORT`

### Frontend Can't Connect to Backend

**Verify CORS:**
The backend CORS is configured to allow `.railway.app` domains.

**Check environment variable:**
```
NEXT_PUBLIC_API_URL=https://your-backend-service.up.railway.app
```

**Clear cache and rebuild:**
1. Delete frontend service
2. Recreate and deploy

### Database Not Found

**Check file paths:**
```javascript
const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
```

**Verify files are deployed:**
```bash
railway run bash
ls -la otb-database/
```

### Deployment Size Too Large

**Add `.slugignore`:**
```
# Exclude from deployment
*.db-wal
*.db-shm
otb-database/pgn-files/
otb-database/processed/
node_modules/
.git/
```

**Or migrate to PostgreSQL**

---

## Alternative: Use Railway's Internal Networking

If you don't want public backend URL:

1. **Don't generate domain** for backend
2. **Use internal service URL**: `backend.railway.internal`
3. **Update frontend env**:
   ```
   NEXT_PUBLIC_API_URL=https://backend.railway.internal
   ```

This keeps backend private within Railway network.

---

## Production Checklist

- [ ] Backend service created and deployed
- [ ] Backend health check passes
- [ ] Backend public URL obtained
- [ ] Frontend env var updated with backend URL
- [ ] Frontend redeployed
- [ ] Frontend console shows correct API URL
- [ ] Data loads on frontend pages
- [ ] No CORS errors
- [ ] No mixed content errors
- [ ] Database accessible (or migrated to PostgreSQL)

---

## Next Steps

1. **Monitor services**: Set up Railway alerts
2. **Add logging**: Use Railway logs or external service
3. **Database migration**: Consider PostgreSQL for production
4. **CDN**: Use Vercel/Cloudflare for frontend caching
5. **Custom domain**: Add your domain to both services

---

## Commands Reference

```bash
# Railway CLI
railway login
railway link
railway up
railway logs
railway run bash

# Check services
railway status

# Environment variables
railway variables
railway variables set KEY=VALUE

# Restart service
railway restart
```

---

## Cost Estimate

**Free Tier:**
- 2 services (frontend + backend): $0
- 512MB RAM per service
- Limited compute hours

**Pro Tier ($20/month):**
- Unlimited services
- More RAM/CPU
- Better support

**PostgreSQL Plugin:**
- Free: 512MB storage
- Starter: $5/month (1GB)

---

## Summary

1. Create backend service on Railway
2. Configure to run `node simple-server.js`
3. Get backend public URL
4. Update frontend `NEXT_PUBLIC_API_URL`
5. Redeploy frontend
6. Verify both services work

All communication now over HTTPS within Railway! 🚀
