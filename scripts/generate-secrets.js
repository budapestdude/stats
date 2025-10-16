#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate secure random secrets for production environment
 */

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

function generateApiKey() {
  return `cs_${crypto.randomBytes(32).toString('hex')}`;
}

function generateSecurePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

function main() {
  console.log('🔐 Generating secure secrets for production...\n');

  const secrets = {
    SESSION_SECRET: generateSecret(64),
    JWT_SECRET: generateSecret(64),
    COOKIE_SECRET: generateSecret(32),
    API_KEY: generateApiKey(),
    ADMIN_API_KEY: generateApiKey(),
    REDIS_PASSWORD: generateSecurePassword(24),
    DB_ENCRYPTION_KEY: generateSecret(32),
    CSRF_SECRET: generateSecret(32)
  };

  // Display secrets
  console.log('Generated Secrets (save these securely!):\n');
  console.log('==========================================');
  
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
  
  console.log('==========================================\n');

  // Create .env.production.local if it doesn't exist
  const envFile = path.join(process.cwd(), '.env.production.local');
  
  if (fs.existsSync(envFile)) {
    console.log('⚠️  .env.production.local already exists. Secrets displayed above but not saved.');
    console.log('   Copy them manually to avoid overwriting existing configuration.\n');
  } else {
    const envContent = Object.entries(secrets)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(envFile, `# Auto-generated secrets - ${new Date().toISOString()}\n${envContent}\n`);
    console.log('✅ Secrets saved to .env.production.local\n');
  }

  // Security recommendations
  console.log('📋 Security Recommendations:');
  console.log('   1. Never commit .env.production.local to version control');
  console.log('   2. Store a backup of these secrets in a secure password manager');
  console.log('   3. Use different secrets for each environment (dev, staging, prod)');
  console.log('   4. Rotate secrets periodically (every 90 days recommended)');
  console.log('   5. Use environment-specific secret management (AWS Secrets Manager, HashiCorp Vault, etc.)');
  console.log('\n🔒 Add to .gitignore:');
  console.log('   .env.production.local');
  console.log('   .env.*.local');
  console.log('   *.key');
  console.log('   *.pem');
}

if (require.main === module) {
  main();
}

module.exports = { generateSecret, generateApiKey, generateSecurePassword };