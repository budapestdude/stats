# HTTPS Setup Guide for chess.us.kg

## Prerequisites
- Domain: `chess.us.kg`
- Hetzner Server IP: `195.201.6.244`
- SSH access to Hetzner server

## Step 1: Configure DNS Records

Go to your domain registrar (us.kg) and add these DNS records:

### A Record (Main Domain)
```
Type: A
Name: @
Value: 195.201.6.244
TTL: 3600 (or Auto)
```

### A Record (www subdomain - optional)
```
Type: A
Name: www
Value: 195.201.6.244
TTL: 3600 (or Auto)
```

### Verification
Wait 5-10 minutes for DNS propagation, then test:
```bash
# Check if DNS is working
nslookup chess.us.kg
# Should show: 195.201.6.244

# Or use online tool: https://dnschecker.org/
```

## Step 2: Install NGINX and Certbot on Hetzner

SSH into your Hetzner server:
```bash
ssh root@195.201.6.244
```

### Install NGINX (if not already installed)
```bash
# Update packages
sudo apt update

# Install NGINX
sudo apt install nginx -y

# Start and enable NGINX
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Install Certbot
```bash
# Install Certbot and NGINX plugin
sudo apt install certbot python3-certbot-nginx -y

# Verify installation
certbot --version
```

## Step 3: Configure NGINX for Chess Stats

Create NGINX configuration:
```bash
sudo nano /etc/nginx/sites-available/chess-stats
```

Paste this configuration:
```nginx
# HTTP server - will redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name chess.us.kg www.chess.us.kg;

    # Certbot verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS (will be added by Certbot)
    # location / {
    #     return 301 https://$server_name$request_uri;
    # }
}

# HTTPS server (Certbot will configure this)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name chess.us.kg www.chess.us.kg;
#
#     # SSL certificates (Certbot will add these)
#     # ssl_certificate /etc/letsencrypt/live/chess.us.kg/fullchain.pem;
#     # ssl_certificate_key /etc/letsencrypt/live/chess.us.kg/privkey.pem;
#
#     # Proxy to Node.js backend
#     location / {
#         proxy_pass http://localhost:3007;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

## Step 4: Get SSL Certificate with Certbot

Run Certbot to get and install SSL certificate:
```bash
# Get certificate and auto-configure NGINX
sudo certbot --nginx -d chess.us.kg -d www.chess.us.kg

# Follow the prompts:
# 1. Enter email address
# 2. Agree to terms (Y)
# 3. Choose whether to redirect HTTP to HTTPS (recommended: 2)
```

Certbot will:
- Obtain SSL certificate from Let's Encrypt
- Automatically configure NGINX for HTTPS
- Set up automatic renewal

### Verify SSL
```bash
# Check certificate
sudo certbot certificates

# Test renewal (dry run)
sudo certbot renew --dry-run
```

## Step 5: Update NGINX Configuration for Node.js

After Certbot configures SSL, update the HTTPS server block:
```bash
sudo nano /etc/nginx/sites-available/chess-stats
```

Find the HTTPS server block (added by Certbot) and ensure it has:
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chess.us.kg www.chess.us.kg;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/chess.us.kg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chess.us.kg/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin "https://chess-stats-production.up.railway.app" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
    }
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Ensure Node.js Server is Running

Check if your Node.js server is running:
```bash
# Check if server is running
ps aux | grep node

# If not running, start it
cd /path/to/chess-stats
node simple-server.js &

# Or use PM2 (recommended for production)
npm install -g pm2
pm2 start simple-server.js --name chess-stats
pm2 save
pm2 startup
```

## Step 7: Update Railway Environment Variable

In Railway dashboard:
1. Go to your frontend service
2. Navigate to **Variables** tab
3. Update `NEXT_PUBLIC_API_URL`:
   ```
   NEXT_PUBLIC_API_URL=https://chess.us.kg
   ```
4. Save and redeploy

## Step 8: Test HTTPS Connection

### From Command Line
```bash
# Test HTTPS health endpoint
curl https://chess.us.kg/health

# Test HTTPS API endpoint
curl https://chess.us.kg/api/players/magnuscarlsen

# Check SSL certificate
curl -vI https://chess.us.kg
```

### From Browser
1. Visit: `https://chess.us.kg/health`
2. Should see: `{"status":"healthy",...}`
3. Check for padlock icon in address bar

### From Railway Frontend
1. Visit your Railway URL
2. Open browser DevTools (F12) → Console
3. Should see data loading without errors
4. Network tab should show HTTPS requests to chess.us.kg

## Troubleshooting

### DNS Not Resolving
```bash
# Check DNS propagation
nslookup chess.us.kg

# Use online checker
https://dnschecker.org/
```
**Solution**: Wait 10-30 minutes for DNS propagation

### Certbot Fails
```bash
# Error: Can't resolve domain
# Solution: DNS not propagated yet, wait and retry

# Error: Port 80 not accessible
sudo ufw allow 80
sudo ufw allow 443
```

### NGINX 502 Bad Gateway
```bash
# Check if Node.js is running
ps aux | grep node

# Check Node.js port
netstat -tlnp | grep 3007

# Check NGINX error logs
sudo tail -f /var/log/nginx/error.log
```

### Mixed Content Errors Persist
- Ensure `NEXT_PUBLIC_API_URL=https://chess.us.kg` (with HTTPS)
- Rebuild and redeploy Railway frontend
- Clear browser cache

## Automatic SSL Renewal

Certbot sets up automatic renewal. Verify:
```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

Certificates auto-renew every 60 days.

## Firewall Configuration

Ensure ports are open:
```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check firewall status
sudo ufw status
```

## Final Checklist

- [ ] DNS A record points to 195.201.6.244
- [ ] DNS has propagated (check with nslookup)
- [ ] NGINX installed and running
- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] NGINX configured for HTTPS
- [ ] Node.js server running on port 3007
- [ ] HTTPS works: `curl https://chess.us.kg/health`
- [ ] Railway env updated to `https://chess.us.kg`
- [ ] Railway redeployed
- [ ] Frontend loads data without errors

## Quick Command Summary

```bash
# SSH to server
ssh root@195.201.6.244

# Install everything
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# Get SSL certificate (after DNS is configured)
sudo certbot --nginx -d chess.us.kg -d www.chess.us.kg

# Start Node.js server
pm2 start simple-server.js --name chess-stats

# Test
curl https://chess.us.kg/health
```

## Support

If you encounter issues:
1. Check NGINX logs: `sudo tail -f /var/log/nginx/error.log`
2. Check Node.js logs: `pm2 logs chess-stats`
3. Test SSL: `https://www.ssllabs.com/ssltest/`
