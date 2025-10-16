const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Database Backup Script for Chess Stats
 *
 * Features:
 * - Creates timestamped backups of SQLite databases
 * - Supports compression to save space
 * - Maintains configurable number of backups
 * - Provides backup rotation (automatic cleanup of old backups)
 * - Can be scheduled via cron or Windows Task Scheduler
 */

// Configuration
const CONFIG = {
  // Database paths
  databases: [
    {
      name: 'complete-tournaments',
      path: path.join(__dirname, '../otb-database/complete-tournaments.db'),
      backupDir: path.join(__dirname, '../backups/complete-tournaments')
    },
    {
      name: 'chess-stats-10m',
      path: path.join(__dirname, '../otb-database/chess-stats-10m.db'),
      backupDir: path.join(__dirname, '../backups/chess-stats-10m')
    }
  ],

  // Backup retention
  maxBackups: 7, // Keep last 7 backups
  compress: true, // Use gzip compression

  // Notification settings
  notifyOnError: true,
  notifyOnSuccess: false
};

class DatabaseBackup {
  constructor(config) {
    this.config = config;
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Create backup directory if it doesn't exist
   */
  ensureBackupDir(backupDir) {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`✓ Created backup directory: ${backupDir}`);
    }
  }

  /**
   * Get database file size in MB
   */
  getDatabaseSize(dbPath) {
    try {
      const stats = fs.statSync(dbPath);
      return (stats.size / (1024 * 1024)).toFixed(2);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Create a backup of a single database
   */
  async backupDatabase(db) {
    console.log(`\n📦 Backing up: ${db.name}`);

    try {
      // Check if database exists
      if (!fs.existsSync(db.path)) {
        console.log(`⚠️  Database not found: ${db.path}`);
        return false;
      }

      // Ensure backup directory exists
      this.ensureBackupDir(db.backupDir);

      // Get database size
      const dbSize = this.getDatabaseSize(db.path);
      console.log(`   Database size: ${dbSize} MB`);

      // Create backup filename
      const backupFilename = `${db.name}_${this.timestamp}.db`;
      const backupPath = path.join(db.backupDir, backupFilename);

      // Copy database file
      console.log(`   Copying to: ${backupPath}`);
      fs.copyFileSync(db.path, backupPath);

      // Compress if enabled
      if (this.config.compress) {
        console.log(`   Compressing backup...`);
        try {
          // Use native tar/gzip on Unix or 7z on Windows
          if (process.platform === 'win32') {
            // Try using PowerShell compression
            const psCommand = `Compress-Archive -Path "${backupPath}" -DestinationPath "${backupPath}.zip" -Force`;
            execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
            fs.unlinkSync(backupPath); // Remove uncompressed file
            console.log(`   ✓ Compressed: ${backupFilename}.zip`);
          } else {
            execSync(`gzip "${backupPath}"`, { stdio: 'ignore' });
            console.log(`   ✓ Compressed: ${backupFilename}.gz`);
          }
        } catch (error) {
          console.log(`   ⚠️  Compression failed, keeping uncompressed backup`);
        }
      }

      // Rotate backups (remove old ones)
      this.rotateBackups(db.backupDir);

      console.log(`   ✓ Backup completed successfully`);
      return true;

    } catch (error) {
      console.error(`   ✗ Backup failed: ${error.message}`);
      if (this.config.notifyOnError) {
        this.notifyError(db.name, error);
      }
      return false;
    }
  }

  /**
   * Rotate backups - keep only the N most recent backups
   */
  rotateBackups(backupDir) {
    try {
      const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.db') || file.endsWith('.gz') || file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by newest first

      // Remove old backups
      if (files.length > this.config.maxBackups) {
        const toRemove = files.slice(this.config.maxBackups);
        console.log(`   Rotating backups (keeping ${this.config.maxBackups} most recent)`);

        toRemove.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`   Removed old backup: ${file.name}`);
        });
      }
    } catch (error) {
      console.error(`   ⚠️  Backup rotation failed: ${error.message}`);
    }
  }

  /**
   * Run backup for all configured databases
   */
  async runBackup() {
    console.log('='.repeat(60));
    console.log('🗄️  Chess Stats Database Backup');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toLocaleString()}`);
    console.log(`Max backups: ${this.config.maxBackups}`);
    console.log(`Compression: ${this.config.compress ? 'enabled' : 'disabled'}`);

    const results = [];
    for (const db of this.config.databases) {
      const success = await this.backupDatabase(db);
      results.push({ name: db.name, success });
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backup Summary:');
    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      console.log(`   ${status} ${result.name}`);
    });
    console.log('='.repeat(60));
    console.log(`Completed: ${new Date().toLocaleString()}\n`);

    return results.every(r => r.success);
  }

  /**
   * Send error notification (can be extended with email, Slack, etc.)
   */
  notifyError(dbName, error) {
    // TODO: Implement email/Slack notification
    console.error(`\n⚠️  BACKUP ERROR for ${dbName}:`);
    console.error(`   ${error.message}`);
    console.error(`   Timestamp: ${new Date().toLocaleString()}`);
  }

  /**
   * List all available backups
   */
  listBackups() {
    console.log('='.repeat(60));
    console.log('📋 Available Backups:');
    console.log('='.repeat(60));

    this.config.databases.forEach(db => {
      console.log(`\n${db.name}:`);

      if (!fs.existsSync(db.backupDir)) {
        console.log('   No backups found');
        return;
      }

      const files = fs.readdirSync(db.backupDir)
        .filter(file => file.endsWith('.db') || file.endsWith('.gz') || file.endsWith('.zip'))
        .map(file => {
          const filePath = path.join(db.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: (stats.size / (1024 * 1024)).toFixed(2),
            date: stats.mtime.toLocaleString()
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (files.length === 0) {
        console.log('   No backups found');
      } else {
        files.forEach(file => {
          console.log(`   ${file.name} (${file.size} MB) - ${file.date}`);
        });
      }
    });
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Restore database from backup
   */
  restoreBackup(dbName, backupFilename) {
    const db = this.config.databases.find(d => d.name === dbName);
    if (!db) {
      console.error(`✗ Database ${dbName} not found in configuration`);
      return false;
    }

    const backupPath = path.join(db.backupDir, backupFilename);

    if (!fs.existsSync(backupPath)) {
      console.error(`✗ Backup file not found: ${backupPath}`);
      return false;
    }

    try {
      console.log(`🔄 Restoring ${dbName} from ${backupFilename}...`);

      // Create a backup of current database before restoring
      const currentBackup = `${db.path}.before-restore-${this.timestamp}`;
      if (fs.existsSync(db.path)) {
        fs.copyFileSync(db.path, currentBackup);
        console.log(`   Created safety backup: ${path.basename(currentBackup)}`);
      }

      // Decompress if needed
      let sourceFile = backupPath;
      if (backupFilename.endsWith('.gz')) {
        console.log(`   Decompressing...`);
        execSync(`gunzip -c "${backupPath}" > "${backupPath}.temp"`, { stdio: 'ignore' });
        sourceFile = `${backupPath}.temp`;
      } else if (backupFilename.endsWith('.zip')) {
        console.log(`   Decompressing...`);
        const psCommand = `Expand-Archive -Path "${backupPath}" -DestinationPath "${db.backupDir}" -Force`;
        execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
        sourceFile = backupPath.replace('.zip', '');
      }

      // Restore database
      fs.copyFileSync(sourceFile, db.path);

      // Cleanup temp files
      if (sourceFile !== backupPath && fs.existsSync(sourceFile)) {
        fs.unlinkSync(sourceFile);
      }

      console.log(`✓ Database restored successfully`);
      console.log(`  Safety backup saved at: ${currentBackup}`);
      return true;

    } catch (error) {
      console.error(`✗ Restore failed: ${error.message}`);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'backup';

  const backup = new DatabaseBackup(CONFIG);

  switch (command) {
    case 'backup':
      backup.runBackup();
      break;

    case 'list':
      backup.listBackups();
      break;

    case 'restore':
      if (args.length < 3) {
        console.error('Usage: node backup-database.js restore <db-name> <backup-filename>');
        console.error('Example: node backup-database.js restore complete-tournaments complete-tournaments_2025-10-03T12-00-00-000Z.db');
        process.exit(1);
      }
      backup.restoreBackup(args[1], args[2]);
      break;

    default:
      console.log('Usage:');
      console.log('  node backup-database.js backup   - Create backups');
      console.log('  node backup-database.js list     - List available backups');
      console.log('  node backup-database.js restore <db-name> <backup-file> - Restore from backup');
      process.exit(1);
  }
}

module.exports = DatabaseBackup;
