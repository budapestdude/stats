#!/bin/bash

# HTTPS Setup Script for Chess Stats
# Domain: chess.us.kg
# Server: Hetzner 195.201.6.244

set -e

echo "=================================="
echo "Chess Stats HTTPS Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="chess.us.kg"
WWW_DOMAIN="www.chess.us.kg"
NODE_PORT="3007"
EMAIL="your-email@example.com"  # Change this!

echo -e "${YELLOW}Please update the EMAIL variable in this script before running!${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo "Step 1: Checking DNS resolution..."
if host $DOMAIN > /dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS is configured${NC}"
else
    echo -e "${RED}✗ DNS is not configured yet${NC}"
    echo "Please configure your DNS A record:"
    echo "  Type: A"
    echo "  Name: @"
    echo "  Value: 195.201.6.244"
    echo ""
    echo "Waiting for DNS propagation... (this may take 10-30 minutes)"
    exit 1
fi

echo ""
echo "Step 2: Installing NGINX..."
apt update
apt install -y nginx

echo ""
echo "Step 3: Installing Certbot..."
apt install -y certbot python3-certbot-nginx

echo ""
echo "Step 4: Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
echo "y" | ufw enable || true

echo ""
echo "Step 5: Creating NGINX configuration..."
cat > /etc/nginx/sites-available/chess-stats << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name chess.us.kg www.chess.us.kg;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload NGINX
systemctl reload nginx

echo ""
echo "Step 6: Obtaining SSL certificate..."
echo -e "${YELLOW}This will prompt for email and agreement${NC}"
certbot --nginx -d $DOMAIN -d $WWW_DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

echo ""
echo "Step 7: Testing SSL certificate..."
if curl -s https://$DOMAIN/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS is working!${NC}"
else
    echo -e "${YELLOW}⚠ HTTPS endpoint not responding (Node.js may not be running)${NC}"
fi

echo ""
echo "Step 8: Setting up automatic renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Ensure Node.js server is running on port $NODE_PORT"
echo "2. Update Railway NEXT_PUBLIC_API_URL to: https://$DOMAIN"
echo "3. Redeploy Railway frontend"
echo ""
echo "Test HTTPS:"
echo "  curl https://$DOMAIN/health"
echo ""
echo "SSL certificate will auto-renew every 60 days."
echo ""
