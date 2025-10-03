# Railway Deployment Checklist - Fix API URL Issues

## ✅ Completed (Already Done)
- [x] Created central API configuration in `frontend/lib/config.ts`
- [x] Replaced all hardcoded `localhost:3007` URLs in frontend source files
- [x] Updated 19+ files to use dynamic `API_BASE_URL`
- [x] Created API configuration test page at `/api-config-test`
- [x] Pushed all changes to GitHub (commits: 587e24b, ad4de46, df563f3, 0180493)
- [x] Configured `next.config.js` to use `NEXT_PUBLIC_API_URL` environment variable

## 🔧 Railway Configuration (TO DO)

### Step 1: Verify Railway Environment Variables
- [ ] Open Railway dashboard at https://railway.app
- [ ] Navigate to your Chess Stats project
- [ ] Click on the frontend service
- [ ] Go to the **Variables** tab
- [ ] Verify `NEXT_PUBLIC_API_URL` is set to `http://195.201.6.244`
- [ ] If not set, add it:
  - Variable name: `NEXT_PUBLIC_API_URL`
  - Value: `http://195.201.6.244`
  - Click "Add" or "Save"

### Step 2: Trigger Railway Rebuild
- [ ] After setting environment variable, Railway should auto-rebuild
- [ ] If not, manually trigger rebuild:
  - Go to **Deployments** tab
  - Click **Deploy** → **Redeploy**
- [ ] Wait for build to complete (watch the logs)
- [ ] Verify build shows: "Building with NEXT_PUBLIC_API_URL=http://195.201.6.244"

### Step 3: Test API Configuration Page
- [ ] Open your Railway deployment URL (e.g., `https://chess-stats-production.up.railway.app`)
- [ ] Navigate to `/api-config-test`
- [ ] Verify the displayed values:

  **Expected Values:**
  - [ ] **API URL (Runtime)**: Should show `http://195.201.6.244`
  - [ ] **Current Hostname**: Your Railway domain (e.g., `chess-stats-production.up.railway.app`)
  - [ ] **NEXT_PUBLIC_API_URL (Build Time)**: Should show `http://195.201.6.244`
  - [ ] **Is Localhost?**: Should show "No"

  **If values are incorrect:**
  - [ ] Take a screenshot
  - [ ] Check Railway build logs for environment variable issues
  - [ ] Verify environment variable is in the "Shared Variables" or correct service

- [ ] Click the **Test Health Endpoint** button
- [ ] Verify you get a successful response from Hetzner backend

### Step 4: Test Actual Player Pages
- [ ] Clear browser cache (Ctrl+Shift+Delete → Clear all)
- [ ] Hard refresh (Ctrl+Shift+R or Ctrl+F5)
- [ ] Navigate to `/players/magnus-carlsen`
- [ ] Open browser Developer Tools (F12) → **Console** tab
- [ ] Look for `[Config]` debug logs showing:
  ```
  [Config] API URL Configuration:
    BUILD_TIME_API_URL: http://195.201.6.244
    Current hostname: <your-railway-domain>
    Selected API URL: http://195.201.6.244
  ```
- [ ] Verify the page loads successfully without "Failed to fetch" errors
- [ ] Check Network tab to confirm API calls go to `http://195.201.6.244/api/...`

### Step 5: Verify Other Pages
- [ ] Test `/players` page loads correctly
- [ ] Test `/games` page loads correctly
- [ ] Test `/openings` page loads correctly
- [ ] Test `/tournaments` page loads correctly
- [ ] Verify no console errors about `localhost:3007` or `localhost:3010`

## 🐛 Troubleshooting Guide

### Issue: Build Time Variable Shows "not set"
**Cause:** Railway didn't set the environment variable during build

**Solutions:**
- [ ] Verify environment variable is set at the **service level**, not project level
- [ ] Check if variable is in "Shared Variables" section
- [ ] Try removing and re-adding the variable
- [ ] Trigger manual redeploy after setting variable
- [ ] Check Railway build logs for `NEXT_PUBLIC_API_URL` references

### Issue: Still Getting `localhost:3007` in Browser
**Cause:** Browser is caching old JavaScript bundle

**Solutions:**
- [ ] Clear all browser cache and cookies
- [ ] Open in Incognito/Private browsing window
- [ ] Try different browser
- [ ] Check if Railway actually rebuilt (check deployment timestamp)
- [ ] Verify new deployment is live (check deployment ID in Railway)

### Issue: API URL Shows Correct Value But Still Fails
**Cause:** CORS or network issue with Hetzner backend

**Solutions:**
- [ ] Verify Hetzner backend is running:
  - [ ] Open `http://195.201.6.244/health` in browser
  - [ ] Should return: `{"status":"ok","message":"Chess Stats API is running"}`
- [ ] Check CORS configuration in `simple-server.js`:
  - [ ] Verify Railway URL is in `allowedOrigins` array
  - [ ] Should include: `https://chess-stats-production.up.railway.app`
- [ ] Check browser console for CORS errors
- [ ] Verify Hetzner server port 3007 is accessible (not blocked by firewall)

### Issue: Environment Variable Set But Not Applied
**Cause:** Next.js caches environment variables in build output

**Solutions:**
- [ ] Ensure Railway is doing a **fresh build**, not using cached build
- [ ] Check Railway build logs for "Cache restored" messages
- [ ] Try clearing Railway build cache:
  - [ ] Go to Settings → Clear Build Cache
  - [ ] Trigger new deployment
- [ ] Verify `next.config.js` has correct env configuration

## 📋 Local Testing Checklist

### Test Local Development Setup
- [ ] Open `http://localhost:3000/api-config-test`
- [ ] Verify **API URL (Runtime)** shows: `http://localhost:3010`
- [ ] Verify **Is Localhost?** shows: "Yes"
- [ ] Click **Test Health Endpoint** button
- [ ] Should connect to local backend on port 3010

### Test Production Build Locally
- [ ] Run `cd frontend && npm run build`
- [ ] Set environment variable: `export NEXT_PUBLIC_API_URL=http://195.201.6.244` (Linux/Mac)
  - Windows: `set NEXT_PUBLIC_API_URL=http://195.201.6.244`
- [ ] Run `npm start`
- [ ] Open `http://localhost:3000/api-config-test`
- [ ] Verify **API URL (Runtime)** shows: `http://195.201.6.244`
- [ ] Verify **Build Time Variable** shows: `http://195.201.6.244`

## 🔍 Debug Information to Collect

If issues persist, collect this information:

### From Railway Deployment:
- [ ] Screenshot of `/api-config-test` page showing all values
- [ ] Browser console output (F12 → Console tab)
- [ ] Network tab showing failed API request details
- [ ] Railway build logs (full output)
- [ ] Railway environment variables screenshot
- [ ] Deployment URL and deployment ID

### From Hetzner Backend:
- [ ] Test `http://195.201.6.244/health` endpoint
- [ ] Test `http://195.201.6.244/api/test` endpoint
- [ ] Check CORS configuration in `simple-server.js`
- [ ] Verify backend is running on correct port (3007)
- [ ] Check backend logs for incoming requests

### From Browser:
- [ ] Full console output including `[Config]` logs
- [ ] Network tab filtered to show API calls
- [ ] Screenshots of any error messages
- [ ] Browser and version information

## ✨ Success Criteria

You'll know everything is working when:
- [ ] `/api-config-test` shows `http://195.201.6.244` as API URL
- [ ] No browser console errors about `localhost`
- [ ] Player pages load successfully on Railway
- [ ] Network tab shows API calls to `http://195.201.6.244/api/...`
- [ ] Test Health Endpoint button returns successful response
- [ ] All pages (`/players`, `/games`, `/openings`, etc.) work correctly

## 📝 Notes

**Important Files:**
- `frontend/lib/config.ts` - Central API configuration
- `frontend/next.config.js` - Next.js environment variable configuration
- `simple-server.js` - Hetzner backend with CORS configuration

**Key Commits:**
- `587e24b` - Fixed hardcoded localhost:3005 in api.ts
- `ad4de46` - Replaced all hardcoded localhost:3007 with central config
- `df563f3` - Fixed runtime API URL detection
- `0180493` - Added API configuration test page

**Railway Environment Variables Required:**
- `NEXT_PUBLIC_API_URL=http://195.201.6.244`

**Hetzner Backend:**
- IP: `195.201.6.244`
- Port: `3007`
- Health endpoint: `http://195.201.6.244/health`
- Test endpoint: `http://195.201.6.244/api/test`

---

## 🚀 Quick Start (If Starting Fresh)

1. **Set Railway Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=http://195.201.6.244
   ```

2. **Trigger Railway Rebuild:**
   - Push to GitHub (already done) OR
   - Manual redeploy in Railway dashboard

3. **Test Configuration:**
   - Visit: `https://your-app.railway.app/api-config-test`
   - Verify all values are correct

4. **Test Player Pages:**
   - Visit: `https://your-app.railway.app/players/magnus-carlsen`
   - Should load successfully

5. **Done!** 🎉

---

**Last Updated:** 2025-10-03
**Status:** Awaiting Railway environment variable verification
