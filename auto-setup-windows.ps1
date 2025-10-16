# Chess Stats - Windows Auto-Setup Script for Hetzner + GitHub
# Run this in PowerShell as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,

    [Parameter(Mandatory=$true)]
    [string]$ServerPassword
)

Write-Host "🚀 Chess Stats Auto-Deployment Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Function to execute SSH commands
function Execute-SSHCommand {
    param($Command)
    Write-Host "Executing: $Command" -ForegroundColor Yellow
    $sshCommand = "sshpass -p '$ServerPassword' ssh -o StrictHostKeyChecking=no root@$ServerIP `"$Command`""
    $result = cmd /c $sshCommand 2>&1
    return $result
}

# Step 1: Install sshpass if needed (for automated SSH)
Write-Host "`n📦 Step 1: Checking dependencies..." -ForegroundColor Green
if (!(Get-Command sshpass -ErrorAction SilentlyContinue)) {
    Write-Host "Installing sshpass for Windows..." -ForegroundColor Yellow
    # Download plink instead (PuTTY's command line tool)
    $plinkUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe"
    Invoke-WebRequest -Uri $plinkUrl -OutFile "$env:TEMP\plink.exe"
    $env:Path += ";$env:TEMP"
}

# Step 2: Generate SSH keys on server
Write-Host "`n🔑 Step 2: Generating SSH keys on server..." -ForegroundColor Green

$setupScript = @'
#!/bin/bash
# Generate SSH key if it doesn't exist
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa
fi

# Output keys
echo "===PRIVATE_KEY_START==="
cat ~/.ssh/id_rsa
echo "===PRIVATE_KEY_END==="
echo "===PUBLIC_KEY_START==="
cat ~/.ssh/id_rsa.pub
echo "===PUBLIC_KEY_END==="

# Clone repository
cd /app
rm -rf chess-stats
git clone https://github.com/budapestdude/stats.git chess-stats
cd chess-stats

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2
npm install -g pm2

# Install dependencies
npm install --production

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'chess-stats',
    script: './simple-server-pooled.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    }
  }]
};
EOF

# Start application
pm2 stop chess-stats 2>/dev/null
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -n 1 | bash

echo "===SETUP_COMPLETE==="
'@

# Execute setup script on server
Write-Host "Connecting to server and running setup..." -ForegroundColor Yellow
$scriptPath = "$env:TEMP\setup.sh"
$setupScript | Out-File -FilePath $scriptPath -Encoding UTF8

# Use plink for automated SSH
$plinkCmd = "$env:TEMP\plink.exe -pw $ServerPassword root@$ServerIP -batch"

# Upload and run script
Write-Host "Uploading setup script..." -ForegroundColor Yellow
& cmd /c "echo y | $plinkCmd `"cat > /tmp/setup.sh`" < $scriptPath"
$result = & cmd /c "echo y | $plinkCmd `"bash /tmp/setup.sh`""

# Parse the output to get keys
$output = $result -join "`n"
$privateKey = ""
$publicKey = ""

if ($output -match "===PRIVATE_KEY_START===(.+?)===PRIVATE_KEY_END===") {
    $privateKey = $Matches[1].Trim()
}
if ($output -match "===PUBLIC_KEY_START===(.+?)===PUBLIC_KEY_END===") {
    $publicKey = $Matches[1].Trim()
}

# Step 3: Save keys to files
Write-Host "`n💾 Step 3: Saving keys..." -ForegroundColor Green
$privateKey | Out-File -FilePath ".\hetzner_private_key.txt" -Encoding UTF8
$publicKey | Out-File -FilePath ".\hetzner_public_key.txt" -Encoding UTF8

Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Now do these steps manually in GitHub:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Add Deploy Key:" -ForegroundColor Cyan
Write-Host "   - Go to: https://github.com/budapestdude/stats/settings/keys" -ForegroundColor White
Write-Host "   - Click 'Add deploy key'" -ForegroundColor White
Write-Host "   - Title: 'Hetzner Server'" -ForegroundColor White
Write-Host "   - Key: Copy from file 'hetzner_public_key.txt'" -ForegroundColor White
Write-Host "   - Check 'Allow write access'" -ForegroundColor White
Write-Host ""
Write-Host "2. Add Secrets:" -ForegroundColor Cyan
Write-Host "   - Go to: https://github.com/budapestdude/stats/settings/secrets/actions" -ForegroundColor White
Write-Host "   - Add secret 'HETZNER_HOST' = $ServerIP" -ForegroundColor White
Write-Host "   - Add secret 'HETZNER_SSH_KEY' = Copy from 'hetzner_private_key.txt'" -ForegroundColor White
Write-Host ""
Write-Host "3. Push your code:" -ForegroundColor Cyan
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Deploy to Hetzner'" -ForegroundColor White
Write-Host "   git push" -ForegroundColor White
Write-Host ""
Write-Host "Your server is running at: http://$ServerIP" -ForegroundColor Green
Write-Host "Health check: http://${ServerIP}/health" -ForegroundColor Green

# Open the key files
notepad .\hetzner_public_key.txt
notepad .\hetzner_private_key.txt