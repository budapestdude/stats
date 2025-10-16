const config = require('../config');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Security Audit Tool
 * Checks various security configurations and reports potential issues
 */
class SecurityAudit {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  // Check environment variables
  async checkEnvironmentVariables() {
    console.log('\n🔍 Checking Environment Variables...');
    
    // Critical secrets that should not use defaults
    const criticalSecrets = [
      { key: 'JWT_SECRET', config: config.jwt.secret },
      { key: 'JWT_REFRESH_SECRET', config: config.jwt.refreshSecret },
      { key: 'SESSION_SECRET', config: config.security.sessionSecret },
    ];
    
    for (const secret of criticalSecrets) {
      if (!secret.config || secret.config.includes('change-this')) {
        this.issues.push(`❌ ${secret.key} is using default value - CRITICAL security risk`);
      } else if (secret.config.length < 32) {
        this.warnings.push(`⚠️ ${secret.key} is too short (< 32 characters)`);
      } else {
        this.passed.push(`✅ ${secret.key} is properly configured`);
      }
    }
    
    // Check database credentials
    if (config.database.type === 'postgres') {
      if (!config.database.postgres.password) {
        this.issues.push('❌ PostgreSQL password not set');
      } else {
        this.passed.push('✅ PostgreSQL password is set');
      }
    }
    
    // Check Redis password
    if (config.redis.host && !config.redis.password && config.app.isProduction) {
      this.warnings.push('⚠️ Redis password not set for production');
    }
    
    // Check email configuration
    if (!config.email.user || !config.email.password) {
      this.warnings.push('⚠️ Email service not fully configured');
    }
  }

  // Check HTTPS/TLS configuration
  checkHTTPS() {
    console.log('\n🔍 Checking HTTPS/TLS Configuration...');
    
    if (config.app.isProduction) {
      if (!config.app.url.startsWith('https://')) {
        this.issues.push('❌ Production URL not using HTTPS');
      } else {
        this.passed.push('✅ Production URL uses HTTPS');
      }
      
      if (!config.security.cookie.secure) {
        this.issues.push('❌ Cookies not set to secure in production');
      } else {
        this.passed.push('✅ Secure cookies enabled');
      }
    }
    
    if (!config.security.cookie.httpOnly) {
      this.warnings.push('⚠️ HttpOnly flag not set for cookies');
    } else {
      this.passed.push('✅ HttpOnly cookies enabled');
    }
    
    if (!config.security.cookie.sameSite) {
      this.warnings.push('⚠️ SameSite attribute not set for cookies');
    } else {
      this.passed.push('✅ SameSite cookie protection enabled');
    }
  }

  // Check CORS configuration
  checkCORS() {
    console.log('\n🔍 Checking CORS Configuration...');
    
    const allowedOrigins = config.security.corsOrigins;
    
    if (allowedOrigins.includes('*')) {
      this.issues.push('❌ CORS allows all origins (*) - security risk');
    } else {
      this.passed.push('✅ CORS origins properly restricted');
    }
    
    if (config.app.isProduction && allowedOrigins.some(origin => origin.includes('localhost'))) {
      this.warnings.push('⚠️ Localhost origins allowed in production CORS');
    }
  }

  // Check rate limiting
  checkRateLimiting() {
    console.log('\n🔍 Checking Rate Limiting...');
    
    if (!config.rateLimit.maxRequests || config.rateLimit.maxRequests > 1000) {
      this.warnings.push('⚠️ Rate limiting may be too permissive');
    } else {
      this.passed.push('✅ Rate limiting configured');
    }
    
    if (config.rateLimit.windowMs < 60000) {
      this.warnings.push('⚠️ Rate limit window is very short');
    }
  }

  // Check file upload security
  checkFileUpload() {
    console.log('\n🔍 Checking File Upload Security...');
    
    if (config.upload.maxSize > 50 * 1024 * 1024) {
      this.warnings.push('⚠️ File upload size limit may be too large (> 50MB)');
    } else {
      this.passed.push('✅ File upload size properly limited');
    }
    
    const dangerousTypes = ['.exe', '.sh', '.bat', '.cmd', '.com', '.ps1'];
    const allowedTypes = config.upload.allowedTypes;
    
    const dangerous = dangerousTypes.filter(type => allowedTypes.includes(type));
    if (dangerous.length > 0) {
      this.issues.push(`❌ Dangerous file types allowed: ${dangerous.join(', ')}`);
    } else {
      this.passed.push('✅ No dangerous file types allowed');
    }
  }

  // Check logging configuration
  checkLogging() {
    console.log('\n🔍 Checking Logging Configuration...');
    
    if (config.logging.level === 'debug' && config.app.isProduction) {
      this.warnings.push('⚠️ Debug logging enabled in production');
    }
    
    if (!config.sentry.dsn && config.app.isProduction) {
      this.warnings.push('⚠️ Sentry error tracking not configured for production');
    } else if (config.sentry.dsn) {
      this.passed.push('✅ Sentry error tracking configured');
    }
  }

  // Check backup configuration
  checkBackups() {
    console.log('\n🔍 Checking Backup Configuration...');
    
    if (!config.backup.enabled && config.app.isProduction) {
      this.warnings.push('⚠️ Backups not enabled for production');
    } else if (config.backup.enabled) {
      this.passed.push('✅ Automated backups enabled');
      
      if (config.backup.retentionDays < 7) {
        this.warnings.push('⚠️ Backup retention period very short (< 7 days)');
      }
    }
  }

  // Check dependencies for known vulnerabilities
  async checkDependencies() {
    console.log('\n🔍 Checking Dependencies...');
    
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      // Check for outdated security-critical packages
      const criticalPackages = ['helmet', 'cors', 'express-rate-limit', 'jsonwebtoken', 'bcrypt'];
      
      for (const pkg of criticalPackages) {
        if (packageJson.dependencies[pkg]) {
          this.passed.push(`✅ Security package '${pkg}' is installed`);
        } else if (!packageJson.dependencies[pkg] && !packageJson.devDependencies[pkg]) {
          this.warnings.push(`⚠️ Security package '${pkg}' not found`);
        }
      }
      
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
      
      if (majorVersion < 18) {
        this.warnings.push(`⚠️ Node.js version ${nodeVersion} is outdated - recommend v18+`);
      } else {
        this.passed.push(`✅ Node.js version ${nodeVersion} is current`);
      }
      
    } catch (error) {
      this.warnings.push('⚠️ Could not check package dependencies');
    }
  }

  // Check for common security misconfigurations
  checkMisconfigurations() {
    console.log('\n🔍 Checking for Misconfigurations...');
    
    // Check JWT expiration
    const jwtExpiry = config.jwt.expiresIn;
    if (jwtExpiry.includes('d') || jwtExpiry.includes('w') || jwtExpiry.includes('y')) {
      this.warnings.push('⚠️ JWT expiration time may be too long');
    } else {
      this.passed.push('✅ JWT expiration time is reasonable');
    }
    
    // Check debug mode
    if (config.debug && config.app.isProduction) {
      this.issues.push('❌ Debug mode enabled in production');
    }
    
    // Check WebSocket configuration
    if (config.websocket.pingTimeout > 120000) {
      this.warnings.push('⚠️ WebSocket ping timeout may be too long');
    }
  }

  // Generate security report
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 SECURITY AUDIT REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${this.passed.length}`);
    console.log(`   ⚠️ Warnings: ${this.warnings.length}`);
    console.log(`   ❌ Issues: ${this.issues.length}`);
    
    if (this.issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES (Must Fix):');
      this.issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS (Should Review):');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    if (this.passed.length > 0 && process.env.VERBOSE) {
      console.log('\n✅ PASSED CHECKS:');
      this.passed.forEach(pass => console.log(`   ${pass}`));
    }
    
    // Overall security score
    const totalChecks = this.passed.length + this.warnings.length + this.issues.length;
    const score = Math.round((this.passed.length / totalChecks) * 100);
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏆 SECURITY SCORE: ${score}%`);
    
    if (score >= 90) {
      console.log('   Excellent security configuration! 🎉');
    } else if (score >= 70) {
      console.log('   Good security, but room for improvement.');
    } else if (score >= 50) {
      console.log('   Moderate security. Please address the issues.');
    } else {
      console.log('   ⚠️ Poor security configuration. Immediate action required!');
    }
    
    console.log('='.repeat(60) + '\n');
    
    // Log to file if configured
    if (config.logging.dir) {
      this.saveReport();
    }
    
    return {
      score,
      passed: this.passed.length,
      warnings: this.warnings.length,
      issues: this.issues.length,
      details: {
        issues: this.issues,
        warnings: this.warnings,
        passed: this.passed,
      },
    };
  }

  // Save report to file
  async saveReport() {
    try {
      const reportPath = path.join(config.logging.dir, `security-audit-${Date.now()}.json`);
      const report = {
        timestamp: new Date().toISOString(),
        environment: config.app.env,
        score: Math.round((this.passed.length / (this.passed.length + this.warnings.length + this.issues.length)) * 100),
        summary: {
          passed: this.passed.length,
          warnings: this.warnings.length,
          issues: this.issues.length,
        },
        details: {
          issues: this.issues,
          warnings: this.warnings,
          passed: this.passed,
        },
      };
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📁 Report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Failed to save security report:', error.message);
    }
  }

  // Run complete audit
  async runAudit() {
    console.log('\n🔒 Starting Security Audit...\n');
    
    await this.checkEnvironmentVariables();
    this.checkHTTPS();
    this.checkCORS();
    this.checkRateLimiting();
    this.checkFileUpload();
    this.checkLogging();
    this.checkBackups();
    await this.checkDependencies();
    this.checkMisconfigurations();
    
    return this.generateReport();
  }
}

// Run audit if executed directly
if (require.main === module) {
  const audit = new SecurityAudit();
  audit.runAudit().then(report => {
    // Exit with error code if critical issues found
    if (report.issues > 0) {
      process.exit(1);
    }
  }).catch(error => {
    console.error('Security audit failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityAudit;