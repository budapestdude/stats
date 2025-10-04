# Railway API Connection Fix

## Problem
Railway frontend is not connecting to the Hetzner backend API.

## Root Cause Analysis

### ✅ Verified Working Components
1. **Hetzner Backend** - Running correctly
   - Health endpoint: `http://195.201.6.244/health` ✅
   - API endpoint: `http://195.201.6.244/api/players/magnuscarlsen` ✅
   - Port: 80 (default HTTP)

2. **CORS Configuration** - Properly configured
   - Railway origin allowed: `https://chess-stats-production.up.railway.app` ✅
   - Credentials enabled: `Access-Control-Allow-Credentials: true` ✅
   - Methods allowed: GET, HEAD, PUT, PATCH, POST, DELETE ✅

3. **Frontend Configuration** - Code is correct
   - Uses `getApiBaseUrl()` function from `lib/config.ts`
   - Default fallback: `http://195.201.6.244`
   - Localhost detection works properly

### ❌ Issue Identified
The Railway deployment likely doesn't have the `NEXT_PUBLIC_API_URL` environment variable set.

## Solution

### Step 1: Set Environment Variable in Railway

1. Go to your Railway project dashboard
2. Navigate to your frontend service
3. Click on **Variables** tab
4. Add the following environment variable:

```
NEXT_PUBLIC_API_URL=http://195.201.6.244
```

5. Click **Save** or **Add**

### Step 2: Redeploy

Railway should automatically redeploy after saving the environment variable. If not:

1. Go to **Deployments** tab
2. Click **Deploy** or trigger a new deployment

### Step 3: Verify

1. Visit your Railway URL: `https://chess-stats-production.up.railway.app`
2. Open browser DevTools (F12) → Console
3. Look for the log message:
   ```
   [Config] API URL Configuration:
     BUILD_TIME_API_URL: http://195.201.6.244
     Current hostname: chess-stats-production.up.railway.app
     Selected API URL: http://195.201.6.244
   ```

4. Visit `/api-config-test` page to see the configuration visually

### Step 4: Test API Connection

Visit any page that loads data:
- `/players` - Should show player data
- `/` (home page) - Should show stats
- `/openings` - Should show opening data

## Alternative: Update Default in Code

If you can't set environment variables in Railway, update the default in `frontend/lib/config.ts`:

```typescript
const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244';
```

This line already has the correct default, so the environment variable is optional.

## Debugging

### Check Current API URL in Railway

1. Visit: `https://chess-stats-production.up.railway.app/api-config-test`
2. Check the displayed API URL
3. Should show: `http://195.201.6.244`

### Browser Console Debugging

Open DevTools → Console and run:
```javascript
// Check current API configuration
console.log('API URL:', window.location.hostname === 'localhost' ? 'http://localhost:3010' : 'http://195.201.6.244');

// Test API call
fetch('http://195.201.6.244/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### Network Tab Debugging

1. Open DevTools → Network tab
2. Reload the page
3. Filter by "XHR" or "Fetch"
4. Check if requests are going to:
   - ❌ Wrong: `http://localhost:3010` (local dev server)
   - ✅ Correct: `http://195.201.6.244` (Hetzner backend)

## Expected Behavior

### Local Development
- Hostname: `localhost` or `127.0.0.1`
- API URL: `http://localhost:3010`

### Railway Production
- Hostname: `chess-stats-production.up.railway.app`
- API URL: `http://195.201.6.244`

## Verification Checklist

- [ ] Railway environment variable `NEXT_PUBLIC_API_URL` is set to `http://195.201.6.244`
- [ ] Railway deployment completed successfully
- [ ] Browser console shows correct API URL
- [ ] `/api-config-test` page displays Hetzner URL
- [ ] Data loads on `/players`, `/`, `/openings` pages
- [ ] Network tab shows requests to `195.201.6.244`
- [ ] No CORS errors in browser console

## Still Not Working?

### Check Browser Console for Errors

Look for:
1. **CORS errors** - Should not happen (CORS is configured)
2. **Mixed content errors** - HTTP content blocked on HTTPS page
3. **Network errors** - Connection refused or timeout

### Mixed Content Issue (HTTPS → HTTP)

If Railway serves over HTTPS but Hetzner is HTTP, browsers may block the requests.

**Solution**: Configure Hetzner to use HTTPS with SSL certificate:
```bash
# On Hetzner server
sudo certbot --nginx -d 195.201.6.244
```

Then update environment variable:
```
NEXT_PUBLIC_API_URL=https://195.201.6.244
```

## Quick Test Commands

```bash
# Test Hetzner backend
curl http://195.201.6.244/health

# Test with CORS headers (simulate Railway origin)
curl -H "Origin: https://chess-stats-production.up.railway.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://195.201.6.244/api/players/magnuscarlsen -v

# Test actual API endpoint
curl http://195.201.6.244/api/players/magnuscarlsen
```

## Summary

The infrastructure is correct. The issue is likely:
1. Missing `NEXT_PUBLIC_API_URL` environment variable in Railway
2. OR Mixed content (HTTPS→HTTP) blocking if Railway serves over HTTPS

**Quick Fix**: Set `NEXT_PUBLIC_API_URL=http://195.201.6.244` in Railway and redeploy.
