# 🚀 Super Simple Setup Guide

## Option 1: Easiest Way (Just Copy & Paste)

### Step 1: Find Your Server Info
1. Go to: https://console.hetzner.cloud/
2. Click on your server
3. Copy the **IP address** (like `116.203.123.45`)
4. Check your email for the **root password** Hetzner sent you

### Step 2: Connect Using Windows
Open **Command Prompt** or **PowerShell** and paste:
```
ssh root@YOUR_SERVER_IP
```
When asked for password, paste the password from your email.

**Can't connect?** Try this online SSH tool instead:
1. Go to: https://console.hetzner.cloud/
2. Click your server
3. Click "CONSOLE" button (top right)
4. This opens a web-based terminal - no SSH needed!

### Step 3: Run This One Command
Once connected, paste this entire block:
```bash
curl -o setup.sh https://raw.githubusercontent.com/budapestdude/stats/main/hetzner-deploy.sh && \
chmod +x setup.sh && \
./setup.sh
```

If that doesn't work, use this alternative:
```bash
# Generate SSH keys
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa

# Show your keys
echo "SAVE THIS PRIVATE KEY:"
cat ~/.ssh/id_rsa
echo "SAVE THIS PUBLIC KEY:"
cat ~/.ssh/id_rsa.pub

# Clone and start your app
cd /app
git clone https://github.com/budapestdude/stats.git chess-stats
cd chess-stats
npm install
npm install -g pm2
pm2 start simple-server.js --name chess-stats
```

### Step 4: Add Keys to GitHub
1. Go to: https://github.com/budapestdude/stats/settings/keys
2. Add the **PUBLIC key** as a deploy key
3. Go to: https://github.com/budapestdude/stats/settings/secrets/actions
4. Add two secrets:
   - `HETZNER_HOST` = Your server IP
   - `HETZNER_SSH_KEY` = The PRIVATE key

### Done! ✅
Your site is now at: `http://YOUR_SERVER_IP`

---

## Option 2: Let Me Do Everything (Automated Script)

### If you can't SSH, use Hetzner's Web Console:
1. Go to https://console.hetzner.cloud/
2. Click your server
3. Click "CONSOLE" button
4. You're now in your server!
5. Run the commands from Step 3 above

---

## Need Help?

### Can't find your password?
- Check email from Hetzner with subject "Access data for your server"
- Or reset it: Hetzner Console → Your Server → RESET PASSWORD

### Can't connect with SSH?
- Make sure you're using the right IP
- Try the web console instead (no SSH needed)
- Check Windows Firewall isn't blocking

### Commands not working?
Try this simplified version:
```bash
# Just get your app running
apt update
apt install -y nodejs npm git
cd /app
git clone https://github.com/budapestdude/stats.git chess-stats
cd chess-stats
npm install
node simple-server.js
```

Your app is now running! Visit `http://YOUR_SERVER_IP:3007`