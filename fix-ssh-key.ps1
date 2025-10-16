# PowerShell script to generate proper RSA SSH key for GitHub Actions

Write-Host "SSH Key Fix for GitHub Actions Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# The server details
$serverIP = "195.201.6.244"

Write-Host "We need to generate a new RSA key in the correct format." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please follow these steps:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Connect to your server using the Hetzner Console:" -ForegroundColor Cyan
Write-Host "   - Go to: https://console.hetzner.cloud/" -ForegroundColor White
Write-Host "   - Click on your server" -ForegroundColor White
Write-Host "   - Click the CONSOLE button (top right)" -ForegroundColor White
Write-Host ""
Write-Host "2. Once connected, run these commands one by one:" -ForegroundColor Cyan
Write-Host ""
Write-Host "# Remove old keys" -ForegroundColor Yellow
Write-Host "rm -f ~/.ssh/id_rsa ~/.ssh/id_rsa.pub" -ForegroundColor White
Write-Host ""
Write-Host "# Generate new RSA key (IMPORTANT: Use RSA, not ed25519)" -ForegroundColor Yellow
Write-Host "ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ''" -ForegroundColor White
Write-Host ""
Write-Host "# Add key to authorized_keys" -ForegroundColor Yellow
Write-Host "cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys" -ForegroundColor White
Write-Host ""
Write-Host "# Display the PRIVATE key (you'll need this for GitHub)" -ForegroundColor Yellow
Write-Host "cat ~/.ssh/id_rsa" -ForegroundColor White
Write-Host ""
Write-Host "# Display the PUBLIC key (for GitHub deploy keys)" -ForegroundColor Yellow
Write-Host "cat ~/.ssh/id_rsa.pub" -ForegroundColor White
Write-Host ""
Write-Host "3. Update GitHub Secrets:" -ForegroundColor Cyan
Write-Host "   - Go to: https://github.com/budapestdude/stats/settings/secrets/actions" -ForegroundColor White
Write-Host "   - Click on HETZNER_SSH_KEY" -ForegroundColor White
Write-Host "   - Click 'Update'" -ForegroundColor White
Write-Host "   - Replace with the NEW private key (including -----BEGIN RSA PRIVATE KEY-----)" -ForegroundColor White
Write-Host "   - Save" -ForegroundColor White
Write-Host ""
Write-Host "4. The deployment should now work!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to open the Hetzner console in your browser..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Start-Process "https://console.hetzner.cloud/"