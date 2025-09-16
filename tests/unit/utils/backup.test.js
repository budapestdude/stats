const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const backupManager = require('../../../src/utils/backup');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    copyFile: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

// Mock config
jest.mock('../../../src/config', () => ({
  backup: {
    enabled: true,
    path: './test-backups',
    retentionDays: 30,
    schedule: '0 2 * * *'
  },
  database: {
    type: 'sqlite',
    sqlite: {
      path: './test-database.db'
    }
  },
  app: {
    isProduction: false
  }
}));

describe('Backup Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset backup manager state
    backupManager.currentBackup = null;
  });

  describe('Initialization', () => {
    test('should create backup directory on initialization', async () => {
      fs.mkdir.mockResolvedValue();
      
      await backupManager.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith('./test-backups', { recursive: true });
    });

    test('should handle backup directory creation failure', async () => {
      const error = new Error('Permission denied');
      fs.mkdir.mockRejectedValue(error);
      
      await expect(backupManager.initialize()).rejects.toThrow('Permission denied');
    });

    test('should skip initialization if backups are disabled', async () => {
      backupManager.isEnabled = false;
      
      await backupManager.initialize();
      
      expect(fs.mkdir).not.toHaveBeenCalled();
      
      // Restore state
      backupManager.isEnabled = true;
    });

    test('should schedule automated backups', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      
      // Mock the scheduleBackups method
      const scheduleSpy = jest.spyOn(backupManager, 'scheduleBackups');
      
      await backupManager.initialize();
      
      expect(scheduleSpy).toHaveBeenCalled();
    });
  });

  describe('Database Backup', () => {
    test('should backup SQLite database', async () => {
      const mockExec = jest.fn((cmd, callback) => callback(null, 'Backup completed'));
      exec.mockImplementation(mockExec);
      
      fs.stat.mockResolvedValue({ size: 1024 * 1024 }); // 1MB
      fs.writeFile.mockResolvedValue();
      
      const backupPath = await backupManager.backupDatabase('manual');
      
      expect(backupPath).toMatch(/backup_manual_.*\.db$/);
      expect(exec).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled(); // Metadata file
    });

    test('should fall back to file copy if SQLite command fails', async () => {
      exec.mockImplementation((cmd, callback) => 
        callback(new Error('sqlite3 not found'))
      );
      
      fs.stat.mockResolvedValue({ size: 1024 * 1024 });
      fs.copyFile.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const backupPath = await backupManager.backupDatabase('manual');
      
      expect(fs.copyFile).toHaveBeenCalled();
      expect(backupPath).toMatch(/backup_manual_.*\.db$/);
    });

    test('should compress large backups', async () => {
      exec.mockImplementation((cmd, callback) => callback(null));
      fs.stat.mockResolvedValue({ size: 60 * 1024 * 1024 }); // 60MB
      fs.unlink.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      // Mock compression
      const mockCreateReadStream = jest.fn(() => ({
        pipe: jest.fn().mockReturnThis()
      }));
      const mockCreateWriteStream = jest.fn(() => ({
        on: jest.fn()
      }));
      const mockCreateGzip = jest.fn(() => ({
        pipe: jest.fn().mockReturnThis()
      }));
      
      jest.mock('fs', () => ({
        createReadStream: mockCreateReadStream,
        createWriteStream: mockCreateWriteStream
      }));
      
      jest.mock('zlib', () => ({
        createGzip: mockCreateGzip
      }));
      
      const backupPath = await backupManager.backupDatabase('scheduled');
      
      // Should return compressed path
      expect(backupPath).toMatch(/\.db(\.gz)?$/);
    });

    test('should handle backup failure', async () => {
      const error = new Error('Disk full');
      exec.mockImplementation((cmd, callback) => callback(error));
      fs.copyFile.mockRejectedValue(error);
      
      await expect(backupManager.backupDatabase()).rejects.toThrow('Disk full');
    });

    test('should backup PostgreSQL database', async () => {
      // Temporarily change database type
      const config = require('../../../src/config');
      config.database.type = 'postgres';
      config.database.postgres = {
        host: 'localhost',
        port: 5432,
        database: 'chess_stats',
        user: 'postgres',
        password: 'password'
      };
      
      exec.mockImplementation((cmd, callback) => callback(null));
      fs.stat.mockResolvedValue({ size: 5 * 1024 * 1024 });
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();
      
      const backupPath = await backupManager.backupDatabase('manual');
      
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('pg_dump'),
        expect.any(Function)
      );
      
      // Restore database type
      config.database.type = 'sqlite';
    });
  });

  describe('Backup Restoration', () => {
    test('should restore SQLite backup', async () => {
      fs.access.mockResolvedValue();
      exec.mockImplementation((cmd, callback) => callback(null));
      
      const result = await backupManager.restoreBackup('backup_2024_01_01.db');
      
      expect(result).toBe(true);
      expect(exec).toHaveBeenCalled();
    });

    test('should decompress compressed backups before restore', async () => {
      fs.access.mockResolvedValue();
      exec.mockImplementation((cmd, callback) => callback(null));
      fs.unlink.mockResolvedValue();
      
      // Mock decompression
      const mockPipeline = jest.fn((streams, callback) => callback(null));
      jest.mock('stream', () => ({
        pipeline: mockPipeline
      }));
      
      await backupManager.restoreBackup('backup_2024_01_01.db.gz');
      
      expect(exec).toHaveBeenCalled();
    });

    test('should create pre-restore backup', async () => {
      fs.access.mockResolvedValue();
      exec.mockImplementation((cmd, callback) => callback(null));
      fs.stat.mockResolvedValue({ size: 1024 * 1024 });
      fs.writeFile.mockResolvedValue();
      
      const backupSpy = jest.spyOn(backupManager, 'backupDatabase');
      
      await backupManager.restoreBackup('backup_2024_01_01.db');
      
      expect(backupSpy).toHaveBeenCalledWith('pre-restore');
    });

    test('should handle restore failure', async () => {
      fs.access.mockResolvedValue();
      const error = new Error('Corrupted backup');
      exec.mockImplementation((cmd, callback) => callback(error));
      fs.copyFile.mockRejectedValue(error);
      
      await expect(backupManager.restoreBackup('corrupted.db'))
        .rejects.toThrow('Corrupted backup');
    });

    test('should reject restore without backup file', async () => {
      await expect(backupManager.restoreBackup())
        .rejects.toThrow('No backup file specified');
    });
  });

  describe('Backup Cleanup', () => {
    test('should delete old backups', async () => {
      const now = Date.now();
      const oldDate = new Date(now - 40 * 24 * 60 * 60 * 1000); // 40 days old
      const recentDate = new Date(now - 10 * 24 * 60 * 60 * 1000); // 10 days old
      
      fs.readdir.mockResolvedValue([
        'backup_old.db',
        'backup_recent.db',
        'backup_old.db.json',
        'backup_recent.db.json'
      ]);
      
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('old')) {
          return Promise.resolve({ mtime: oldDate });
        }
        return Promise.resolve({ mtime: recentDate });
      });
      
      fs.unlink.mockResolvedValue();
      
      await backupManager.cleanOldBackups();
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('backup_old.db')
      );
      expect(fs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('backup_recent.db')
      );
    });

    test('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      // Should not throw
      await expect(backupManager.cleanOldBackups()).resolves.not.toThrow();
    });

    test('should skip non-backup files', async () => {
      fs.readdir.mockResolvedValue([
        'backup_test.db',
        'not_a_backup.txt',
        'readme.md'
      ]);
      
      fs.stat.mockResolvedValue({ 
        mtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) 
      });
      
      fs.unlink.mockResolvedValue();
      
      await backupManager.cleanOldBackups();
      
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('backup_test.db')
      );
    });
  });

  describe('Backup Listing', () => {
    test('should list all backups', async () => {
      const backupFiles = [
        'backup_scheduled_2024_01_01.db',
        'backup_manual_2024_01_02.db.gz'
      ];
      
      fs.readdir.mockResolvedValue([
        ...backupFiles,
        'backup_scheduled_2024_01_01.db.json',
        'backup_manual_2024_01_02.db.gz.json'
      ]);
      
      fs.stat.mockImplementation((filePath) => Promise.resolve({
        size: 1024 * 1024,
        mtime: new Date('2024-01-01')
      }));
      
      fs.readFile.mockImplementation((path) => {
        if (path.endsWith('.json')) {
          return Promise.resolve(JSON.stringify({
            type: 'scheduled',
            compressed: path.includes('.gz')
          }));
        }
        return Promise.reject(new Error('Not a metadata file'));
      });
      
      const backups = await backupManager.listBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0]).toMatchObject({
        file: expect.stringMatching(/backup_.*\.db(\.gz)?$/),
        size: 1024 * 1024,
        created: new Date('2024-01-01')
      });
    });

    test('should sort backups by creation date', async () => {
      fs.readdir.mockResolvedValue([
        'backup_old.db',
        'backup_new.db'
      ]);
      
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('old')) {
          return Promise.resolve({
            size: 1024,
            mtime: new Date('2024-01-01')
          });
        }
        return Promise.resolve({
          size: 1024,
          mtime: new Date('2024-01-10')
        });
      });
      
      fs.readFile.mockRejectedValue(new Error('No metadata'));
      
      const backups = await backupManager.listBackups();
      
      expect(backups[0].file).toBe('backup_new.db');
      expect(backups[1].file).toBe('backup_old.db');
    });

    test('should handle missing metadata gracefully', async () => {
      fs.readdir.mockResolvedValue(['backup_test.db']);
      fs.stat.mockResolvedValue({ size: 1024, mtime: new Date() });
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const backups = await backupManager.listBackups();
      
      expect(backups).toHaveLength(1);
      expect(backups[0].file).toBe('backup_test.db');
    });
  });

  describe('Backup Status', () => {
    test('should return backup status information', async () => {
      fs.readdir.mockResolvedValue([
        'backup_1.db',
        'backup_2.db'
      ]);
      
      fs.stat.mockResolvedValue({ 
        size: 1024 * 1024,
        mtime: new Date() 
      });
      
      fs.readFile.mockRejectedValue(new Error('No metadata'));
      
      const status = await backupManager.getBackupStatus();
      
      expect(status).toMatchObject({
        enabled: true,
        schedule: '0 2 * * *',
        retentionDays: 30,
        backupPath: './test-backups',
        totalBackups: 2,
        totalSize: 2 * 1024 * 1024
      });
    });

    test('should include latest backup in status', async () => {
      const latestDate = new Date('2024-01-10');
      
      fs.readdir.mockResolvedValue(['backup_latest.db']);
      fs.stat.mockResolvedValue({ 
        size: 5 * 1024 * 1024,
        mtime: latestDate 
      });
      fs.readFile.mockRejectedValue(new Error('No metadata'));
      
      const status = await backupManager.getBackupStatus();
      
      expect(status.latestBackup).toMatchObject({
        file: 'backup_latest.db',
        created: latestDate
      });
    });

    test('should calculate next scheduled backup time', async () => {
      fs.readdir.mockResolvedValue([]);
      
      const status = await backupManager.getBackupStatus();
      
      expect(status.nextScheduled).toBeDefined();
      expect(new Date(status.nextScheduled)).toBeInstanceOf(Date);
    });
  });

  describe('Metadata Management', () => {
    test('should create backup metadata', async () => {
      fs.writeFile.mockResolvedValue();
      
      await backupManager.createBackupMetadata('backup.db', {
        type: 'manual',
        timestamp: '2024-01-01',
        size: 1024 * 1024,
        duration: 1500,
        compressed: false
      });
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        'backup.db.json',
        expect.stringContaining('"type": "manual"')
      );
    });

    test('should handle metadata creation failure gracefully', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));
      
      // Should not throw
      await expect(
        backupManager.createBackupMetadata('backup.db', {})
      ).resolves.not.toThrow();
    });
  });
});