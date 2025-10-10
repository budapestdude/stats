# Railway Quick Start - Deploy Backend in 5 Minutes

## Quick Steps

### 1. Create Backend Service (2 minutes)
1. Go to Railway dashboard: https://railway.app/dashboard
2. Open your Chess Stats project
3. Click **+ New Service**
4. Select **GitHub Repo**
5. Choose your `budapestdude/stats` repository
6. Railway will auto-detect and start deploying

### 2. Get Backend URL (30 seconds)
1. Click on the new backend service
2. Go to **Settings** tab
3. Under **Networking** → **Generate Domain**
4. Copy the URL (e.g., `https://stats-production-abc.up.railway.app`)

### 3. Update Frontend (1 minute)
1. Click on your frontend service
2. Go to **Variables** tab
3. Find `NEXT_PUBLIC_API_URL`
4. Update to your backend URL from step 2
5. Save (Railway will auto-redeploy)

### 4. Verify (30 seconds)
Visit your frontend URL and check:
- Data loads on homepage
- No errors in browser console (F12)
- Network tab shows requests to your backend URL

## Done! 🎉

Both services now running on Railway with HTTPS!

---

## What Railway Does Automatically

- ✅ Detects `railway.json` and uses configuration
- ✅ Runs `npm install`
- ✅ Executes `node simple-server.js`
- ✅ Assigns a PORT environment variable
- ✅ Generates HTTPS domain
- ✅ Sets up health checks
- ✅ Auto-redeploys on git push

---

## Important Notes

### Database Limitation
The 9.1M game database (`complete-tournaments.db`) is excluded via `.slugignore` because it's too large for Railway.

**Options:**
1. **Use mock/sample data** - Backend will work with limited data
2. **Deploy smaller database** - Create a subset database
3. **Migrate to PostgreSQL** - Add Railway PostgreSQL plugin

### Files Excluded from Deployment
See `.slugignore`:
- Large database files
- PGN source files
- Test files
- Documentation

---

## Troubleshooting

### Backend Fails to Deploy
**Check logs:**
```bash
railway logs
```

**Common fix:**
Make sure `package.json` exists in root directory.

### Frontend Can't Connect
**Verify environment variable:**
1. Frontend service → Variables
2. `NEXT_PUBLIC_API_URL` should be `https://your-backend.up.railway.app`
3. Must start with `https://`

### 404 Errors
Backend needs time to start (30-60 seconds). Wait and refresh.

---

## Next Steps

1. **Monitor** - Set up Railway monitoring
2. **Database** - Decide on database strategy (PostgreSQL recommended)
3. **Custom Domain** - Add your own domain
4. **Scaling** - Upgrade Railway plan if needed

For detailed guide, see **RAILWAY_DEPLOYMENT_GUIDE.md**
