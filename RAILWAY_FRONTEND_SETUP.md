# Railway Frontend Setup Guide

## Current Issue
Frontend service shows "Cannot GET /" because Railway is deploying from the wrong directory.

## Solution: Configure Root Directory

### Step 1: Access Frontend Service Settings

1. Go to https://railway.app/project/your-project-id
2. Click on your **frontend service** (the one at https://invigorating-solace-production.up.railway.app)
3. Go to **Settings** tab

### Step 2: Set Root Directory

1. Scroll down to **Root Directory** setting
2. Set it to: `frontend`
3. Click **Save**

### Step 3: Trigger Redeploy

After saving, Railway should automatically redeploy. If not:
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment

## Expected Result

After redeployment, the frontend should:
- Build successfully with `npm run build`
- Start with `npm start`
- Show the Chess Stats homepage at https://invigorating-solace-production.up.railway.app/

## Verification

Once deployed, test these URLs:

```bash
# Homepage (should show Chess Stats UI)
curl https://invigorating-solace-production.up.railway.app/

# Test page (should work if routes are configured)
curl https://invigorating-solace-production.up.railway.app/test

# Backend health check (from frontend, should proxy or call backend)
curl https://invigorating-solace-production.up.railway.app/api/health
```

## Configuration Files

The following files configure the deployment:

### `frontend/nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ['nodejs_20']

[phases.install]
cmds = ['npm ci']

[phases.build]
cmds = ['npm run build']

[start]
cmd = 'npm start'
```

### `frontend/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### `frontend/next.config.js`
API URL configured to point to backend:
- `NEXT_PUBLIC_API_URL`: https://stats-production-10e3.up.railway.app
- `NEXT_PUBLIC_API_BASE_URL`: https://stats-production-10e3.up.railway.app/api

## Alternative: Manual Configuration in Railway UI

If the Root Directory setting doesn't work, you can also:

1. Go to **Settings** > **Build**
2. Override **Build Command**: `cd frontend && npm ci && npm run build`
3. Override **Start Command**: `cd frontend && npm start`

## Troubleshooting

### Issue: Still shows "Cannot GET /"
**Solution**: Make sure Root Directory is set to `frontend`, not blank or `/`

### Issue: Build fails
**Solution**: Check Railway logs for specific error. Common issues:
- Missing dependencies (should be fixed with `npm ci`)
- TypeScript errors (ignored with `ignoreBuildErrors: true`)
- Memory issues (increase Railway plan if needed)

### Issue: Frontend loads but API calls fail
**Solution**:
1. Check browser console for CORS errors
2. Verify backend is running: https://stats-production-10e3.up.railway.app/health
3. Check `NEXT_PUBLIC_API_URL` in deployed app's environment

### Issue: Pages are slow to load
**Solution**:
- Next.js is building pages on-demand (SSR)
- Consider static generation or ISR for better performance
- Upgrade Railway plan for more resources

## Environment Variables to Set in Railway

In the frontend service settings, optionally set:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | production | Auto-set by Railway |
| `NEXT_PUBLIC_API_URL` | https://stats-production-10e3.up.railway.app | Override in next.config.js |
| `NEXT_PUBLIC_API_BASE_URL` | https://stats-production-10e3.up.railway.app/api | Override in next.config.js |

## Services Architecture

Your Railway project should have **two services**:

### 1. Backend Service
- **URL**: https://stats-production-10e3.up.railway.app
- **Root Directory**: `.` (root of repo)
- **Purpose**: Express API server + SQLite database
- **Health Check**: /health

### 2. Frontend Service
- **URL**: https://invigorating-solace-production.up.railway.app
- **Root Directory**: `frontend` ⚠️ **MUST BE SET**
- **Purpose**: Next.js 15 React app
- **Connects to**: Backend service for API calls

## Next Steps After Frontend Deployment

1. ✅ Verify homepage loads
2. ✅ Test player search functionality
3. ✅ Check API integration with backend
4. ✅ Test all major pages (players, tournaments, openings)
5. ✅ Monitor Railway logs for any errors
6. Configure custom domain (optional)
7. Set up monitoring/analytics (optional)

## Quick Test Commands

After deployment succeeds:

```bash
# Test homepage
curl -I https://invigorating-solace-production.up.railway.app/

# Test if Next.js is serving
curl -s https://invigorating-solace-production.up.railway.app/ | grep -i "chess stats"

# Test backend connection
curl https://stats-production-10e3.up.railway.app/health
```

---

**Important**: The key fix is setting **Root Directory** to `frontend` in the Railway service settings!
