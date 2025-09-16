# GitHub Auto-Deployment Setup

## Option 1: GitHub Actions (Recommended - Easiest!)

### Step 1: Get your server's SSH key
SSH into your Hetzner server and run:
```bash
# If you don't have an SSH key yet:
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa

# Display your PRIVATE key (we need this for GitHub):
cat ~/.ssh/id_rsa
```
Copy the ENTIRE output (including BEGIN and END lines).

### Step 2: Add secrets to GitHub
1. Go to your repository on GitHub
2. Click `Settings` → `Secrets and variables` → `Actions`
3. Click `New repository secret`
4. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `HETZNER_HOST` | Your server IP (e.g., `116.203.123.45`) |
| `HETZNER_SSH_KEY` | The private key from Step 1 (entire content) |

### Step 3: Commit the workflow
The workflow file is already created. Just push it:
```bash
git add .github/workflows/deploy-hetzner.yml
git commit -m "Add auto-deployment to Hetzner"
git push
```

### That's it! 🎉
Now every push to `main` will automatically deploy to your server!

---

## Option 2: Simple Webhook (Direct)

### On your Hetzner server, run this one-liner:
```bash
cd /app/chess-stats && \
cat > auto-deploy.sh << 'EOF'
#!/bin/bash
# Simple auto-deploy setup

# Create deploy script
cat > /app/chess-stats/deploy.sh << 'DEPLOY'
#!/bin/bash
cd /app/chess-stats
git pull
npm install --production
[ -d "frontend" ] && cd frontend && npm install && npm run build && cd ..
pm2 restart chess-stats
echo "Deployed at $(date)"
DEPLOY
chmod +x deploy.sh

# Add to crontab to check for updates every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * cd /app/chess-stats && git fetch && git status | grep -q 'behind' && ./deploy.sh") | crontab -

echo "✅ Auto-deploy configured! Updates check every 5 minutes."
EOF
chmod +x auto-deploy.sh && ./auto-deploy.sh
```

This checks for updates every 5 minutes and auto-deploys if changes are found.

---

## Testing Auto-Deployment

1. Make a small change to your code locally:
```javascript
// In simple-server.js or any file
// Add a comment: Test auto-deploy
```

2. Commit and push:
```bash
git add .
git commit -m "Test auto-deployment"
git push
```

3. Watch it deploy automatically!
   - **GitHub Actions**: Check the Actions tab in GitHub
   - **Webhook**: Check server logs with `pm2 logs`

---

## Monitoring Deployments

### For GitHub Actions:
- Go to: `https://github.com/YOUR_USERNAME/chess-stats/actions`
- You'll see each deployment with status

### On your server:
```bash
# View deployment logs
pm2 logs chess-stats

# Check last deployment
ls -la /app/chess-stats/.git/logs/

# Monitor in real-time
pm2 monit
```

---

## Rollback if Needed

If a deployment breaks something:
```bash
# On server
cd /app/chess-stats
git log --oneline -5  # See recent commits
git reset --hard HEAD~1  # Go back one commit
pm2 restart chess-stats
```

---

## Advanced: Deploy Only on Tags

To deploy only when you create a release tag:

Change in `.github/workflows/deploy-hetzner.yml`:
```yaml
on:
  push:
    tags:
      - 'v*'  # Deploy only on version tags like v1.0.0
```

Then deploy with:
```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Troubleshooting

### SSH Key Issues
```bash
# Test SSH connection from GitHub Actions
ssh -i ~/.ssh/id_rsa root@YOUR_SERVER_IP "echo 'Connected!'"
```

### Permission Issues
```bash
# On server, ensure correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Deployment Not Triggering
- Check GitHub Actions tab for errors
- Ensure you're pushing to `main` branch
- Check secrets are correctly set

---

## Security Best Practices

1. **Use a deployment user** (not root):
```bash
# Create deploy user on server
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
su - deploy
# Set up SSH keys for deploy user
```

2. **Limit SSH key permissions**:
```bash
# In authorized_keys, limit what the key can do:
command="cd /app/chess-stats && ./deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-rsa YOUR_KEY
```

3. **Use environment-specific branches**:
- `main` → production
- `staging` → staging server
- `develop` → development

---

Your auto-deployment is ready! Every code push will now automatically update your live server. 🚀