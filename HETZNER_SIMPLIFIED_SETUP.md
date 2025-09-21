# 🚀 Chess Stats - One-Click Hetzner VPS Setup

Deploy Chess Stats to a Hetzner VPS with **zero configuration** in under 10 minutes!

## 💰 Cost Comparison

| Provider | Configuration | Monthly Cost |
|----------|---------------|--------------|
| **Hetzner VPS** | 4 vCPU, 8GB RAM | **€14.28 (~$15)** |
| Railway | 4 vCPU, 8GB RAM | **~$100-120** |
| DigitalOcean | 4 vCPU, 8GB RAM | **$48** |
| AWS EC2 | 4 vCPU, 8GB RAM | **$60-80** |

**Hetzner is 6-8x cheaper** while providing the same performance!

## 🏃‍♂️ Quick Start (5 Minutes)

### Step 1: Create Hetzner VPS

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Create new project: `chess-stats`
3. Create server:
   - **Location**: Choose closest to your users
   - **Image**: Ubuntu 22.04 or 24.04
   - **Type**: **CPX21** (3 vCPU, 8GB RAM) - €7.56/month
   - **SSH Key**: Add your SSH key
   - **Name**: `chess-stats-server`

### Step 2: One-Command Deployment

SSH into your server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/chess-stats/main/hetzner-one-click-deploy.sh | bash
```

**That's it!** The script automatically:
- ✅ Installs all dependencies (Node.js, Docker, Nginx)
- ✅ Configures firewall and security
- ✅ Sets up the application with PM2
- ✅ Configures Nginx reverse proxy
- ✅ Adds SSL certificates (if domain provided)
- ✅ Creates monitoring and backup scripts

### Step 3: Upload Your Database

From your **local computer**, upload the database:

```bash
# Windows (PowerShell)
scp "C:\Users\micha\OneDrive\Desktop\Code\Chess Stats\complete-tournaments.db" root@YOUR_SERVER_IP:/data/

# Linux/Mac
scp ./complete-tournaments.db root@YOUR_SERVER_IP:/data/
```

## 🌐 Access Your Application

After deployment:
- **Application**: `http://YOUR_SERVER_IP`
- **Health Check**: `http://YOUR_SERVER_IP/health`
- **API Test**: `http://YOUR_SERVER_IP/api/test`

## 🔧 Management Commands

Once deployed, these commands are available on your server:

```bash
# Check application status
./chess-stats-status.sh

# View application logs
pm2 logs chess-stats

# Restart application
pm2 restart chess-stats

# Create backup
./backup-chess-stats.sh

# Upload database helper
./upload-database.sh

# Monitor resources
htop
```

## 🔒 Adding SSL Certificate (Optional)

If you have a domain name:

1. Point your domain to your server IP in DNS
2. Wait for DNS propagation (5-30 minutes)
3. Run on your server:

```bash
certbot --nginx -d yourdomain.com
```

## 📊 Recommended Server Sizes

| Users | Games/Day | Recommended | Monthly Cost |
|-------|-----------|-------------|--------------|
| 1-100 | < 1,000 | **CPX11** (2 vCPU, 4GB) | **€4.15** |
| 100-1K | 1K-10K | **CPX21** (3 vCPU, 8GB) | **€7.56** |
| 1K-10K | 10K-100K | **CPX31** (4 vCPU, 16GB) | **€14.28** |
| 10K+ | 100K+ | **CPX41** (8 vCPU, 32GB) | **€28.56** |

## 🛠️ Advanced Configuration

### Environment Variables

The deployment creates `/app/chess-stats/.env.production` with:

```bash
NODE_ENV=production
PORT=3010
DATABASE_PATH=/data/complete-tournaments.db
CORS_ORIGINS=http://yourdomain.com,https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=100
QUERY_CACHE_ENABLED=true
```

### Nginx Configuration

Located at `/etc/nginx/sites-available/chess-stats`:
- Rate limiting: 30 req/s general, 10 req/s API
- Compression: Gzip enabled
- Security headers: XSS protection, frame options
- SSL ready: Certbot compatible

### PM2 Process Management

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs chess-stats --lines 100

# Restart application
pm2 restart chess-stats

# Reload without downtime
pm2 reload chess-stats

# Monitor resources
pm2 monit
```

## 🔄 Updates and Maintenance

### Update Application

```bash
cd /app/chess-stats
git pull
npm install --production
pm2 restart chess-stats
```

### Database Backup

```bash
# Manual backup
./backup-chess-stats.sh

# Automated daily backup (add to crontab)
0 2 * * * /root/backup-chess-stats.sh
```

### System Updates

```bash
apt update && apt upgrade -y
```

## 🚨 Troubleshooting

### Application Won't Start

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs chess-stats

# Restart
pm2 restart chess-stats
```

### Cannot Access from Internet

```bash
# Check firewall
ufw status

# Check Nginx
systemctl status nginx
nginx -t

# Check if port is listening
netstat -tlpn | grep 3010
```

### Database Issues

```bash
# Check database file exists
ls -la /data/complete-tournaments.db

# Check permissions
chmod 644 /data/complete-tournaments.db

# Test database connection
sqlite3 /data/complete-tournaments.db "SELECT COUNT(*) FROM games;"
```

### High Memory Usage

```bash
# Check memory
free -h

# Restart PM2 (clears memory leaks)
pm2 restart chess-stats

# Check for large log files
du -h /app/chess-stats/logs/
```

## 🔐 Security Hardening

The deployment includes basic security, but for production:

### SSH Security

```bash
# Disable password authentication
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Change SSH port (optional)
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
ufw allow 2222/tcp
ufw delete allow 22/tcp
systemctl restart ssh
```

### Additional Firewall Rules

```bash
# Block suspicious countries (example)
ufw deny from 192.168.1.0/24

# Limit SSH attempts
ufw limit ssh
```

### Fail2Ban (Optional)

```bash
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

## 📈 Performance Monitoring

### Built-in Monitoring

The application includes monitoring endpoints:

- `/health` - Basic health check
- `/api/pool/stats` - Database connection pool statistics
- `/monitoring/snapshot` - Performance metrics

### External Monitoring

Consider adding:
- **Uptime monitoring**: UptimeRobot (free)
- **Performance**: New Relic (free tier)
- **Logs**: Papertrail or LogDNA

## 🎯 Production Checklist

- [ ] Server deployed and accessible
- [ ] Database uploaded and working
- [ ] SSL certificate installed
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] DNS configured
- [ ] Firewall rules verified
- [ ] Regular updates scheduled

## 💡 Tips for Success

1. **Use a domain**: Much more professional than IP addresses
2. **Enable SSL**: Required for production applications
3. **Set up monitoring**: Know when things break
4. **Regular backups**: Automated daily backups save lives
5. **Update regularly**: Keep security patches current
6. **Monitor logs**: Check `pm2 logs` regularly

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run `./chess-stats-status.sh` for diagnostics
3. Create an issue with the error details
4. Include output from `pm2 logs chess-stats --lines 50`

## 🎉 Success!

Your Chess Stats application is now running on a production-ready Hetzner VPS for less than $15/month - **6-8x cheaper than alternatives** with the same performance!

---

**Total setup time**: ~10 minutes
**Monthly cost**: €7.56-14.28 ($8-15)
**Performance**: Production-ready with monitoring
**Scalability**: Easily upgrade server size as needed