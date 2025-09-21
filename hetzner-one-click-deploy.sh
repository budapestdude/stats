#!/bin/bash

# Chess Stats - One-Click Hetzner VPS Setup
# This script sets up everything automatically with zero configuration required!
#
# Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/chess-stats/main/hetzner-one-click-deploy.sh | bash
# Or: wget -qO- https://raw.githubusercontent.com/yourusername/chess-stats/main/hetzner-one-click-deploy.sh | bash

set -e  # Exit on any error

# Colors for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Chess Stats"
APP_DIR="/app/chess-stats"
DATA_DIR="/data"
REPO_URL="https://github.com/budapestdude/stats.git"
DOMAIN=""  # Will be set interactively if user wants SSL

# Progress tracking
STEP_COUNT=0
TOTAL_STEPS=20

print_header() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                          🚀 CHESS STATS DEPLOYMENT 🚀                       ║${NC}"
    echo -e "${BLUE}║                          One-Click Hetzner VPS Setup                        ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

step_progress() {
    ((STEP_COUNT++))
    echo -e "${CYAN}[${STEP_COUNT}/${TOTAL_STEPS}]${NC} ${1}"
}

success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

error() {
    echo -e "${RED}❌ ${1}${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  ${1}${NC}"
}

# Get server information
get_server_info() {
    step_progress "Getting server information..."

    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || curl -s ipinfo.io/ip)
    if [[ -z "$SERVER_IP" ]]; then
        error "Could not determine server IP address"
    fi

    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
    VERSION=$(lsb_release -sr 2>/dev/null || echo "Unknown")

    success "Server IP: $SERVER_IP"
    success "OS: $DISTRO $VERSION"

    # Ask about domain and SSL
    echo ""
    read -p "Do you have a domain name you want to use? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your domain name (e.g., chess.yourdomain.com): " DOMAIN
        if [[ ! -z "$DOMAIN" ]]; then
            info "Domain set to: $DOMAIN"
            info "Make sure to point $DOMAIN to $SERVER_IP in your DNS settings"
            echo ""
            read -p "Press Enter when your domain is configured..."
        fi
    fi
}

# System update and essential packages
update_system() {
    step_progress "Updating system packages..."
    export DEBIAN_FRONTEND=noninteractive

    apt update -qq
    apt upgrade -y -qq
    apt install -y -qq curl git wget htop unzip build-essential nginx certbot python3-certbot-nginx ufw software-properties-common apt-transport-https ca-certificates gnupg lsb-release

    success "System updated and essential packages installed"
}

# Install Docker
install_docker() {
    step_progress "Installing Docker..."

    if command -v docker &> /dev/null; then
        success "Docker already installed"
        return
    fi

    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt update -qq
    apt install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    success "Docker installed and started"
}

# Install Docker Compose
install_docker_compose() {
    step_progress "Installing Docker Compose..."

    if command -v docker-compose &> /dev/null; then
        success "Docker Compose already installed"
        return
    fi

    # Install Docker Compose
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    success "Docker Compose installed"
}

# Install Node.js
install_nodejs() {
    step_progress "Installing Node.js 20..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        success "Node.js already installed: $NODE_VERSION"
        return
    fi

    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs

    # Install PM2
    npm install -g pm2 --silent

    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    success "Node.js $NODE_VERSION and npm $NPM_VERSION installed"
}

# Configure firewall
setup_firewall() {
    step_progress "Configuring firewall..."

    # Reset UFW to defaults
    ufw --force reset > /dev/null

    # Set default policies
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null

    # Allow essential services
    ufw allow 22/tcp > /dev/null   # SSH
    ufw allow 80/tcp > /dev/null   # HTTP
    ufw allow 443/tcp > /dev/null  # HTTPS

    # Enable firewall
    echo "y" | ufw enable > /dev/null

    success "Firewall configured and enabled"
}

# Setup application directory
setup_app_directory() {
    step_progress "Setting up application directory..."

    # Create app directory
    mkdir -p $APP_DIR
    cd $APP_DIR

    # Clone or update repository
    if [[ -d ".git" ]]; then
        git pull --quiet
        success "Repository updated"
    else
        # Try to clone the repository
        if git clone $REPO_URL . 2>/dev/null; then
            success "Repository cloned successfully"
        else
            warning "Could not clone repository. Creating minimal structure..."
            # Create minimal project structure
            create_minimal_project
        fi
    fi
}

# Create minimal project if repository doesn't exist
create_minimal_project() {
    # Create package.json
    cat > package.json <<EOF
{
  "name": "chess-stats",
  "version": "1.0.0",
  "description": "Chess Statistics Platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.6",
    "compression": "^1.7.4",
    "helmet": "^7.0.0"
  }
}
EOF

    # Create basic server
    cat > server.js <<'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Chess Stats API is running!',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Chess Stats API is working!',
        server: 'Hetzner VPS',
        timestamp: new Date().toISOString()
    });
});

// Basic frontend
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Chess Stats</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .header { text-align: center; color: #333; }
        .status { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .api-test { background: #f0f8ff; padding: 20px; border-radius: 8px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a87; }
        #result { margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏁 Chess Stats</h1>
        <h2>Successfully Deployed on Hetzner VPS!</h2>
    </div>

    <div class="status">
        <h3>✅ Server Status: Running</h3>
        <p><strong>Server IP:</strong> ${req.get('host')}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
        <p><strong>Started:</strong> ${new Date().toISOString()}</p>
    </div>

    <div class="api-test">
        <h3>🧪 API Test</h3>
        <button onclick="testAPI()">Test API Connection</button>
        <div id="result"></div>
    </div>

    <script>
        async function testAPI() {
            try {
                const response = await fetch('/api/test');
                const data = await response.json();
                document.getElementById('result').innerHTML =
                    '<strong>✅ API Response:</strong><br>' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('result').innerHTML =
                    '<strong>❌ Error:</strong> ' + error.message;
            }
        }
    </script>
</body>
</html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chess Stats server running on port ${PORT}`);
    console.log(`📍 Access at: http://localhost:${PORT}`);
});
EOF

    success "Minimal project structure created"
}

# Setup data directory and database
setup_database() {
    step_progress "Setting up database directory..."

    mkdir -p $DATA_DIR

    # Check for attached Hetzner volume
    if [[ -e /dev/sdb ]]; then
        info "Found attached volume, mounting..."
        mkfs.ext4 /dev/sdb 2>/dev/null || true
        mount /dev/sdb $DATA_DIR 2>/dev/null || true
        echo "/dev/sdb $DATA_DIR ext4 defaults 0 0" >> /etc/fstab
        success "Volume mounted at $DATA_DIR"
    fi

    # Set permissions
    chown -R root:root $DATA_DIR
    chmod 755 $DATA_DIR

    success "Database directory ready"
}

# Install application dependencies
install_dependencies() {
    step_progress "Installing application dependencies..."

    cd $APP_DIR

    if [[ -f "package.json" ]]; then
        npm install --production --silent
        success "Application dependencies installed"
    else
        warning "No package.json found, skipping npm install"
    fi
}

# Create environment configuration
create_environment() {
    step_progress "Creating environment configuration..."

    cd $APP_DIR

    cat > .env.production <<EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3010
APP_NAME="Chess Stats"

# Server
HOST=0.0.0.0
SERVER_IP=$SERVER_IP

# Database
DATABASE_PATH=$DATA_DIR/complete-tournaments.db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
BCRYPT_ROUNDS=10

# CORS Configuration
CORS_ORIGINS=http://$SERVER_IP,https://$SERVER_IP,http://localhost:3000
$(if [[ ! -z "$DOMAIN" ]]; then echo "CORS_ORIGINS=http://$DOMAIN,https://$DOMAIN,http://$SERVER_IP,https://$SERVER_IP"; fi)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_DIR=$APP_DIR/logs

# Cache
CACHE_TTL=300000
QUERY_CACHE_ENABLED=true

# Features
ENABLE_COMPRESSION=true
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
EOF

    success "Environment configuration created"
}

# Create PM2 configuration
create_pm2_config() {
    step_progress "Creating PM2 configuration..."

    cd $APP_DIR

    cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'chess-stats',
    script: './server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3010
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],

    // Advanced PM2 features
    kill_timeout: 5000,
    listen_timeout: 3000,
    restart_delay: 4000,

    // Environment variables
    env_file: '.env.production'
  }]
};
EOF

    success "PM2 configuration created"
}

# Configure Nginx
setup_nginx() {
    step_progress "Configuring Nginx reverse proxy..."

    # Backup default config
    if [[ -f /etc/nginx/sites-enabled/default ]]; then
        mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup
    fi

    # Create new configuration
    cat > /etc/nginx/sites-available/chess-stats <<EOF
# Chess Stats Nginx Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_IP$(if [[ ! -z "$DOMAIN" ]]; then echo " $DOMAIN"; fi);

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-Robots-Tag "noindex, nofollow" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/rss+xml
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
        access_log off;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts for database queries
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check (no rate limiting)
    location = /health {
        access_log off;
        proxy_pass http://localhost:3010/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Main application
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Standard timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Block common attack vectors
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* /(wp-admin|wp-login|xmlrpc\.php|phpmyadmin) {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/chess-stats /etc/nginx/sites-enabled/

    # Test configuration
    if nginx -t > /dev/null 2>&1; then
        systemctl reload nginx
        success "Nginx configured and reloaded"
    else
        error "Nginx configuration test failed"
    fi
}

# Start application
start_application() {
    step_progress "Starting Chess Stats application..."

    cd $APP_DIR

    # Create logs directory
    mkdir -p logs

    # Stop any existing instances
    pm2 delete chess-stats 2>/dev/null || true

    # Start application with PM2
    pm2 start ecosystem.config.js --env production
    pm2 save

    # Configure PM2 to start on boot
    pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true

    success "Application started with PM2"
}

# Setup SSL certificates
setup_ssl() {
    if [[ ! -z "$DOMAIN" ]]; then
        step_progress "Setting up SSL certificate for $DOMAIN..."

        # Check if domain resolves to this server
        RESOLVED_IP=$(dig +short $DOMAIN 2>/dev/null | tail -n1)
        if [[ "$RESOLVED_IP" != "$SERVER_IP" ]]; then
            warning "Domain $DOMAIN does not resolve to this server ($SERVER_IP)"
            warning "Please update your DNS settings and run: certbot --nginx -d $DOMAIN"
            return
        fi

        # Get SSL certificate
        if certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --no-eff-email > /dev/null 2>&1; then
            success "SSL certificate installed for $DOMAIN"
        else
            warning "SSL certificate installation failed. You can try manually: certbot --nginx -d $DOMAIN"
        fi
    else
        step_progress "Skipping SSL setup (no domain configured)..."
        info "To add SSL later with a domain, run: certbot --nginx -d yourdomain.com"
    fi
}

# Create management scripts
create_scripts() {
    step_progress "Creating management scripts..."

    # Status check script
    cat > /root/chess-stats-status.sh <<'EOF'
#!/bin/bash
echo "==================== CHESS STATS STATUS ===================="
echo ""
echo "🔄 PM2 Status:"
pm2 status
echo ""
echo "🌐 Nginx Status:"
systemctl status nginx --no-pager -l | head -n 5
echo ""
echo "💾 Disk Usage:"
df -h | head -n 1
df -h | grep -E '^/dev/'
echo ""
echo "🧠 Memory Usage:"
free -h
echo ""
echo "📊 CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//'
echo ""
echo "🔍 Recent Logs (last 10 lines):"
pm2 logs chess-stats --lines 10 --nostream 2>/dev/null || echo "No logs available"
echo ""
echo "🏥 Health Check:"
curl -s http://localhost:3010/health | jq . 2>/dev/null || curl -s http://localhost:3010/health
echo ""
echo "========================================================"
EOF
    chmod +x /root/chess-stats-status.sh

    # Database upload helper
    cat > /root/upload-database.sh <<EOF
#!/bin/bash
echo "📊 DATABASE UPLOAD HELPER"
echo ""
echo "To upload your database from your local machine, run this command on your LOCAL computer:"
echo ""
echo "scp /path/to/complete-tournaments.db root@$SERVER_IP:$DATA_DIR/"
echo ""
echo "Windows users can use WinSCP or run in PowerShell:"
echo "scp 'C:\\Users\\micha\\OneDrive\\Desktop\\Code\\Chess Stats\\complete-tournaments.db' root@$SERVER_IP:$DATA_DIR/"
echo ""
echo "After upload, restart the application:"
echo "pm2 restart chess-stats"
EOF
    chmod +x /root/upload-database.sh

    # Backup script
    cat > /root/backup-chess-stats.sh <<EOF
#!/bin/bash
BACKUP_DIR="/root/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR

echo "Creating backup..."
tar -czf \$BACKUP_DIR/chess-stats-\$TIMESTAMP.tar.gz \\
    $APP_DIR \\
    $DATA_DIR \\
    /etc/nginx/sites-available/chess-stats

echo "Backup created: \$BACKUP_DIR/chess-stats-\$TIMESTAMP.tar.gz"
ls -lh \$BACKUP_DIR/chess-stats-\$TIMESTAMP.tar.gz
EOF
    chmod +x /root/backup-chess-stats.sh

    success "Management scripts created"
}

# Health checks
run_health_checks() {
    step_progress "Running health checks..."

    # Wait for application to start
    sleep 5

    # Check if PM2 is running the app
    if pm2 list | grep -q "chess-stats.*online"; then
        success "PM2: Application is running"
    else
        error "PM2: Application is not running"
    fi

    # Check if port is listening
    if netstat -tlpn | grep -q ":3010.*LISTEN"; then
        success "Network: Port 3010 is listening"
    else
        error "Network: Port 3010 is not listening"
    fi

    # Check if health endpoint responds
    for i in {1..10}; do
        if curl -s http://localhost:3010/health > /dev/null; then
            success "Health: API endpoint is responding"
            break
        fi
        if [[ $i -eq 10 ]]; then
            error "Health: API endpoint is not responding after 10 attempts"
        fi
        sleep 2
    done

    # Check Nginx
    if systemctl is-active --quiet nginx; then
        success "Nginx: Service is running"
    else
        error "Nginx: Service is not running"
    fi

    # Check external access
    if curl -s http://$SERVER_IP/health > /dev/null; then
        success "External: Server is accessible from internet"
    else
        warning "External: Server might not be accessible from internet"
    fi
}

# Performance optimization
optimize_performance() {
    step_progress "Applying performance optimizations..."

    # Increase file limits
    echo "* soft nofile 65536" >> /etc/security/limits.conf
    echo "* hard nofile 65536" >> /etc/security/limits.conf
    echo "root soft nofile 65536" >> /etc/security/limits.conf
    echo "root hard nofile 65536" >> /etc/security/limits.conf

    # Optimize network settings
    cat >> /etc/sysctl.conf <<EOF

# Chess Stats Network Optimizations
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_congestion_control = bbr
EOF

    sysctl -p > /dev/null

    success "Performance optimizations applied"
}

# Final setup and information
show_completion_info() {
    clear
    print_header

    echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}"
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                             📋 DEPLOYMENT SUMMARY                            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${CYAN}🌐 Access Your Application:${NC}"
    echo -e "   Primary URL: ${GREEN}http://$SERVER_IP${NC}"
    if [[ ! -z "$DOMAIN" ]]; then
        echo -e "   Domain URL:  ${GREEN}https://$DOMAIN${NC}"
    fi
    echo -e "   Health Check: ${GREEN}http://$SERVER_IP/health${NC}"
    echo ""

    echo -e "${CYAN}🔧 Management Commands:${NC}"
    echo -e "   Check Status:     ${YELLOW}./chess-stats-status.sh${NC}"
    echo -e "   Upload Database:  ${YELLOW}./upload-database.sh${NC}"
    echo -e "   Create Backup:    ${YELLOW}./backup-chess-stats.sh${NC}"
    echo -e "   View Logs:        ${YELLOW}pm2 logs chess-stats${NC}"
    echo -e "   Restart App:      ${YELLOW}pm2 restart chess-stats${NC}"
    echo -e "   Monitor Resources: ${YELLOW}htop${NC}"
    echo ""

    echo -e "${CYAN}📊 Next Steps:${NC}"
    echo -e "   1. ${YELLOW}Upload your database:${NC}"
    echo -e "      ${GREEN}scp complete-tournaments.db root@$SERVER_IP:$DATA_DIR/${NC}"
    echo -e "   2. ${YELLOW}Test your application:${NC}"
    echo -e "      ${GREEN}curl http://$SERVER_IP/health${NC}"
    if [[ -z "$DOMAIN" ]]; then
        echo -e "   3. ${YELLOW}Optional - Add domain and SSL:${NC}"
        echo -e "      ${GREEN}certbot --nginx -d yourdomain.com${NC}"
    fi
    echo ""

    echo -e "${CYAN}📝 Important Files:${NC}"
    echo -e "   Application: ${GREEN}$APP_DIR${NC}"
    echo -e "   Database:    ${GREEN}$DATA_DIR${NC}"
    echo -e "   Logs:        ${GREEN}$APP_DIR/logs${NC}"
    echo -e "   Config:      ${GREEN}/etc/nginx/sites-available/chess-stats${NC}"
    echo ""

    echo -e "${CYAN}🔒 Security:${NC}"
    echo -e "   Firewall: ${GREEN}Enabled (SSH, HTTP, HTTPS only)${NC}"
    echo -e "   Rate Limiting: ${GREEN}Enabled in Nginx${NC}"
    echo -e "   Security Headers: ${GREEN}Configured${NC}"
    echo ""

    echo -e "${YELLOW}⚡ Your Chess Stats application is now live and production-ready!${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Error handler
handle_error() {
    echo ""
    error "Deployment failed at step: $1"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting:${NC}"
    echo -e "   1. Check logs: ${GREEN}journalctl -xeu nginx${NC}"
    echo -e "   2. Check app logs: ${GREEN}pm2 logs chess-stats${NC}"
    echo -e "   3. Check status: ${GREEN}./chess-stats-status.sh${NC}"
    echo -e "   4. Manual restart: ${GREEN}pm2 restart chess-stats${NC}"
    echo ""
    echo -e "${BLUE}For support, create an issue with the error details.${NC}"
    exit 1
}

# Main deployment function
main() {
    print_header

    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi

    # Check if Ubuntu/Debian
    if ! command -v apt &> /dev/null; then
        error "This script requires Ubuntu or Debian (apt package manager)"
    fi

    echo -e "${GREEN}Starting automated Chess Stats deployment...${NC}"
    echo ""

    # Set up error handling
    trap 'handle_error "$BASH_COMMAND"' ERR

    # Run deployment steps
    get_server_info
    update_system
    install_docker
    install_docker_compose
    install_nodejs
    setup_firewall
    setup_app_directory
    setup_database
    install_dependencies
    create_environment
    create_pm2_config
    setup_nginx
    start_application
    setup_ssl
    create_scripts
    run_health_checks
    optimize_performance
    show_completion_info
}

# Run main function
main "$@"