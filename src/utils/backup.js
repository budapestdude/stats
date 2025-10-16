const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const cron = require('node-cron');
const config = require('../config');
const logger = require('./logger');

const execAsync = promisify(exec);

class BackupManager {
  constructor() {
    this.backupPath = config.backup.path;
    this.retentionDays = config.backup.retentionDays;
    this.isEnabled = config.backup.enabled;
    this.schedule = config.backup.schedule;
    this.currentBackup = null;
  }

  async initialize() {
    if (!this.isEnabled) {
      logger.info('Backup system is disabled');
      return;
    }

    // Create backup directory if it doesn't exist
    try {
      await fs.mkdir(this.backupPath, { recursive: true });
      logger.info(`Backup directory ensured at: ${this.backupPath}`);
    } catch (error) {
      logger.error('Failed to create backup directory', error);
      throw error;
    }

    // Schedule automated backups
    this.scheduleBackups();

    // Clean old backups on startup
    await this.cleanOldBackups();
  }

  scheduleBackups() {
    if (!this.isEnabled) return;

    // Parse cron schedule (default: 2 AM daily)
    cron.schedule(this.schedule, async () => {
      logger.info('Starting scheduled backup...');
      try {
        await this.backupDatabase();
        await this.cleanOldBackups();
      } catch (error) {
        logger.error('Scheduled backup failed', error);
      }
    });

    logger.info(`Backup scheduled with cron: ${this.schedule}`);
  }

  async backupDatabase(type = 'scheduled') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${type}_${timestamp}.db`;
    const backupFilePath = path.join(this.backupPath, backupFileName);

    try {
      logger.info(`Starting ${type} database backup...`);
      const startTime = Date.now();

      if (config.database.type === 'sqlite') {
        // SQLite backup
        const sourcePath = config.database.sqlite.path;
        
        // Use SQLite's backup command for consistency
        const command = `sqlite3 "${sourcePath}" ".backup '${backupFilePath}'"`;
        
        try {
          await execAsync(command);
        } catch (error) {
          // Fallback to file copy if sqlite3 command not available
          logger.warn('SQLite backup command failed, using file copy fallback');
          await this.copyFile(sourcePath, backupFilePath);
        }

        // Verify backup
        const stats = await fs.stat(backupFilePath);
        const duration = Date.now() - startTime;

        // Compress backup if it's large
        let finalPath = backupFilePath;
        if (stats.size > 50 * 1024 * 1024) { // > 50MB
          finalPath = await this.compressBackup(backupFilePath);
        }

        // Create metadata file
        await this.createBackupMetadata(finalPath, {
          type,
          timestamp,
          size: stats.size,
          duration,
          compressed: finalPath !== backupFilePath,
        });

        logger.info(`Database backup completed successfully`, {
          file: path.basename(finalPath),
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          duration: `${duration}ms`,
        });

        this.currentBackup = finalPath;
        return finalPath;

      } else if (config.database.type === 'postgres') {
        // PostgreSQL backup
        const { host, port, database, user, password } = config.database.postgres;
        
        // Set PGPASSWORD environment variable
        process.env.PGPASSWORD = password;
        
        const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${backupFilePath}"`;
        
        await execAsync(command);
        
        // Clean up environment variable
        delete process.env.PGPASSWORD;

        // Compress the backup
        const finalPath = await this.compressBackup(backupFilePath);

        const stats = await fs.stat(finalPath);
        const duration = Date.now() - startTime;

        await this.createBackupMetadata(finalPath, {
          type,
          timestamp,
          size: stats.size,
          duration,
          compressed: true,
        });

        logger.info(`PostgreSQL backup completed successfully`, {
          file: path.basename(finalPath),
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          duration: `${duration}ms`,
        });

        this.currentBackup = finalPath;
        return finalPath;
      }

    } catch (error) {
      logger.error(`Backup failed: ${error.message}`, { error });
      throw error;
    }
  }

  async copyFile(source, destination) {
    try {
      await fs.copyFile(source, destination);
    } catch (error) {
      logger.error('File copy failed', error);
      throw error;
    }
  }

  async compressBackup(filePath) {
    const compressedPath = `${filePath}.gz`;
    
    try {
      const { createReadStream, createWriteStream } = require('fs');
      const { createGzip } = require('zlib');
      const { pipeline } = require('stream');
      const pipelineAsync = promisify(pipeline);

      await pipelineAsync(
        createReadStream(filePath),
        createGzip({ level: 9 }),
        createWriteStream(compressedPath)
      );

      // Remove original file after successful compression
      await fs.unlink(filePath);

      logger.info(`Backup compressed: ${path.basename(compressedPath)}`);
      return compressedPath;
    } catch (error) {
      logger.error('Backup compression failed', error);
      // Return original path if compression fails
      return filePath;
    }
  }

  async createBackupMetadata(backupPath, metadata) {
    const metadataPath = `${backupPath}.json`;
    
    try {
      await fs.writeFile(
        metadataPath,
        JSON.stringify({
          ...metadata,
          file: path.basename(backupPath),
          created: new Date().toISOString(),
          databaseType: config.database.type,
          retentionDate: new Date(
            Date.now() + this.retentionDays * 24 * 60 * 60 * 1000
          ).toISOString(),
        }, null, 2)
      );
    } catch (error) {
      logger.warn('Failed to create backup metadata', error);
    }
  }

  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupPath);
      const now = Date.now();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
      
      let deletedCount = 0;
      let keptCount = 0;

      for (const file of files) {
        if (!file.startsWith('backup_')) continue;

        const filePath = path.join(this.backupPath, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtime.getTime();

        if (age > retentionMs) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.debug(`Deleted old backup: ${file}`);
        } else {
          keptCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backups, kept ${keptCount}`);
      }
    } catch (error) {
      logger.error('Failed to clean old backups', error);
    }
  }

  async restoreBackup(backupFile) {
    if (!backupFile) {
      throw new Error('No backup file specified');
    }

    const backupPath = path.isAbsolute(backupFile) 
      ? backupFile 
      : path.join(this.backupPath, backupFile);

    try {
      logger.info(`Starting database restore from: ${backupPath}`);
      const startTime = Date.now();

      // Check if backup file exists
      await fs.access(backupPath);

      // Decompress if needed
      let sourcePath = backupPath;
      if (backupPath.endsWith('.gz')) {
        sourcePath = await this.decompressBackup(backupPath);
      }

      if (config.database.type === 'sqlite') {
        // Create a backup of current database before restore
        const currentBackup = await this.backupDatabase('pre-restore');
        logger.info(`Created pre-restore backup: ${currentBackup}`);

        // Restore SQLite database
        const targetPath = config.database.sqlite.path;
        const command = `sqlite3 "${targetPath}" ".restore '${sourcePath}'"`;
        
        try {
          await execAsync(command);
        } catch (error) {
          // Fallback to file copy
          logger.warn('SQLite restore command failed, using file copy fallback');
          await this.copyFile(sourcePath, targetPath);
        }

      } else if (config.database.type === 'postgres') {
        // Restore PostgreSQL database
        const { host, port, database, user, password } = config.database.postgres;
        
        process.env.PGPASSWORD = password;
        
        // Drop and recreate database
        const dropCommand = `psql -h ${host} -p ${port} -U ${user} -c "DROP DATABASE IF EXISTS ${database}"`;
        const createCommand = `psql -h ${host} -p ${port} -U ${user} -c "CREATE DATABASE ${database}"`;
        const restoreCommand = `psql -h ${host} -p ${port} -U ${user} -d ${database} -f "${sourcePath}"`;
        
        await execAsync(dropCommand);
        await execAsync(createCommand);
        await execAsync(restoreCommand);
        
        delete process.env.PGPASSWORD;
      }

      // Clean up temporary decompressed file
      if (sourcePath !== backupPath) {
        await fs.unlink(sourcePath);
      }

      const duration = Date.now() - startTime;
      logger.info(`Database restore completed successfully`, {
        file: path.basename(backupPath),
        duration: `${duration}ms`,
      });

      return true;
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`, { error });
      throw error;
    }
  }

  async decompressBackup(compressedPath) {
    const decompressedPath = compressedPath.replace('.gz', '');
    
    try {
      const { createReadStream, createWriteStream } = require('fs');
      const { createGunzip } = require('zlib');
      const { pipeline } = require('stream');
      const pipelineAsync = promisify(pipeline);

      await pipelineAsync(
        createReadStream(compressedPath),
        createGunzip(),
        createWriteStream(decompressedPath)
      );

      logger.info(`Backup decompressed: ${path.basename(decompressedPath)}`);
      return decompressedPath;
    } catch (error) {
      logger.error('Backup decompression failed', error);
      throw error;
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups = [];

      for (const file of files) {
        if (!file.startsWith('backup_') || file.endsWith('.json')) continue;

        const filePath = path.join(this.backupPath, file);
        const stats = await fs.stat(filePath);

        // Try to read metadata
        let metadata = {};
        try {
          const metadataPath = `${filePath}.json`;
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          // Metadata file might not exist
        }

        backups.push({
          file,
          path: filePath,
          size: stats.size,
          created: stats.mtime,
          ...metadata,
        });
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      return backups;
    } catch (error) {
      logger.error('Failed to list backups', error);
      throw error;
    }
  }

  async getBackupStatus() {
    const backups = await this.listBackups();
    
    return {
      enabled: this.isEnabled,
      schedule: this.schedule,
      retentionDays: this.retentionDays,
      backupPath: this.backupPath,
      totalBackups: backups.length,
      latestBackup: backups[0] || null,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      nextScheduled: this.getNextScheduledTime(),
    };
  }

  getNextScheduledTime() {
    if (!this.isEnabled) return null;
    
    // Parse cron schedule to determine next run
    // This is a simplified version - you might want to use a cron parser library
    const parts = this.schedule.split(' ');
    const now = new Date();
    const next = new Date(now);
    
    // Assuming daily at 2 AM (0 2 * * *)
    if (parts[0] === '0' && parts[1] === '2') {
      next.setHours(2, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }
    
    return next.toISOString();
  }
}

// Create singleton instance
const backupManager = new BackupManager();

// Install cron if not already installed
try {
  require('node-cron');
} catch (error) {
  logger.warn('node-cron not installed. Run: npm install node-cron');
}

module.exports = backupManager;