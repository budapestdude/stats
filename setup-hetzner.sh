#!/bin/bash

# Chess Stats - Ultra-Simple Hetzner Setup
# Run this AFTER creating your Hetzner VPS
#
# Usage:
#   chmod +x setup-hetzner.sh
#   ./setup-hetzner.sh

set -e

echo "🚀 Chess Stats - Hetzner VPS Setup Starting..."
echo ""

# Quick confirmation
read -p "Is this a fresh Ubuntu 22.04/24.04 server? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ This script is designed for fresh Ubuntu servers"
    exit 1
fi

echo "📦 Installing dependencies..."
apt update -qq
apt install -y -qq curl git nginx certbot python3-certbot-nginx ufw

echo "🟢 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y -qq nodejs
npm install -g pm2

echo "🔥 Configuring firewall..."
ufw allow 22 > /dev/null
ufw allow 80 > /dev/null
ufw allow 443 > /dev/null
echo "y" | ufw enable > /dev/null

echo "📁 Setting up application..."
mkdir -p /app/chess-stats
cd /app/chess-stats

# Create basic application if repo doesn't exist
if ! git clone https://github.com/budapestdude/stats.git . 2>/dev/null; then
    echo "Creating minimal Chess Stats application..."

    cat > package.json <<EOF
{
  "name": "chess-stats",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "compression": "^1.7.4"
  }
}
EOF

    cat > server.js <<'EOF'
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();
const PORT = 3010;

app.use(compression());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Chess Stats is running on Hetzner!'
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Chess Stats - Deployed!</title>
    <style>
        body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .success { background: #d4edda; padding: 20px; border-radius: 8px; color: #155724; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>🏁 Chess Stats Deployed Successfully!</h1>
    <div class="success">
        <h2>✅ Your Hetzner VPS is working!</h2>
        <p>Server IP: ${req.get('host')}</p>
    </div>
    <div class="info">
        <h3>Next Steps:</h3>
        <p>1. Upload your chess database</p>
        <p>2. Add your domain and SSL certificate</p>
        <p>3. Configure your full application</p>
    </div>
    <button onclick="testAPI()">Test API</button>
    <div id="result"></div>
    <script>
        async function testAPI() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                document.getElementById('result').innerHTML =
                    '<p style="color: green;">✅ API Working: ' + data.message + '</p>';
            } catch (error) {
                document.getElementById('result').innerHTML =
                    '<p style="color: red;">❌ Error: ' + error.message + '</p>';
            }
        }
    </script>
</body>
</html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chess Stats running on port ${PORT}`);
});
EOF

    npm install --silent
fi

echo "⚙️  Creating PM2 configuration..."
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'chess-stats',
    script: './server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    },
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
EOF

SERVER_IP=$(curl -s ifconfig.me)

echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/chess-stats <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $SERVER_IP _;

    location / {
        proxy_pass http://localhost:3010;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/
systemctl reload nginx

echo "🔄 Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -n 1 | bash > /dev/null

# Create status script
cat > /root/status.sh <<'EOF'
#!/bin/bash
echo "=== Chess Stats Status ==="
pm2 status
echo ""
echo "=== Health Check ==="
curl -s http://localhost:3010/health | head -n 5
echo ""
echo "=== Memory ==="
free -h
EOF
chmod +x /root/status.sh

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📍 Your Chess Stats is now running at: http://$SERVER_IP"
echo "🏥 Health check: http://$SERVER_IP/health"
echo ""
echo "🔧 Management commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs chess-stats - View logs"
echo "  ./status.sh         - Full status check"
echo ""
echo "🔒 To add SSL with a domain:"
echo "  certbot --nginx -d yourdomain.com"
echo ""
echo "✅ Your server is ready! Cost: ~$8-15/month vs $100+ on Railway"