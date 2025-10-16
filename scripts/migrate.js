const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

class DatabaseMigrator {
  constructor(config) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'chess_stats',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || '',
      ...config
    };
    
    this.client = null;
    this.migrationsPath = path.join(__dirname, '..', 'migrations');
  }

  async connect() {
    try {
      this.client = new Client(this.config);
      await this.client.connect();
      console.log('✅ Connected to PostgreSQL database');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log('📦 Disconnected from database');
    }
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations (filename);
    `;
    
    await this.client.query(query);
  }

  async getExecutedMigrations() {
    const result = await this.client.query(
      'SELECT filename FROM migrations ORDER BY id ASC'
    );
    return result.rows.map(row => row.filename);
  }

  async getMigrationFiles() {
    if (!fs.existsSync(this.migrationsPath)) {
      console.warn('⚠️ Migrations directory not found:', this.migrationsPath);
      return [];
    }

    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async executeMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = this.calculateChecksum(content);
    
    console.log(`🔄 Executing migration: ${filename}`);
    const startTime = Date.now();
    
    try {
      // Begin transaction
      await this.client.query('BEGIN');
      
      // Execute migration
      await this.client.query(content);
      
      // Record migration
      await this.client.query(
        'INSERT INTO migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3)',
        [filename, checksum, Date.now() - startTime]
      );
      
      // Commit transaction
      await this.client.query('COMMIT');
      
      console.log(`✅ Migration completed: ${filename} (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      // Rollback transaction
      await this.client.query('ROLLBACK');
      console.error(`❌ Migration failed: ${filename}`);
      throw error;
    }
  }

  async migrate(target = null) {
    try {
      await this.connect();
      
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrations = await this.getMigrationFiles();
      
      console.log(`📋 Found ${allMigrations.length} migration files`);
      console.log(`📋 ${executedMigrations.length} migrations already executed`);
      
      // Find pending migrations
      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );
      
      if (pendingMigrations.length === 0) {
        console.log('✅ All migrations are up to date');
        return;
      }
      
      console.log(`🔄 Found ${pendingMigrations.length} pending migrations:`);
      pendingMigrations.forEach(migration => console.log(`  - ${migration}`));
      
      // Filter to target if specified
      let migrationsToRun = pendingMigrations;
      if (target) {
        const targetIndex = pendingMigrations.indexOf(target);
        if (targetIndex === -1) {
          console.error(`❌ Target migration not found: ${target}`);
          return;
        }
        migrationsToRun = pendingMigrations.slice(0, targetIndex + 1);
        console.log(`🎯 Running migrations up to: ${target}`);
      }
      
      // Execute migrations
      for (const migration of migrationsToRun) {
        await this.executeMigration(migration);
      }
      
      console.log('🎉 All migrations completed successfully!');
      
    } catch (error) {
      console.error('💥 Migration process failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async rollback(target = null) {
    try {
      await this.connect();
      
      const executedMigrations = await this.getExecutedMigrations();
      
      if (executedMigrations.length === 0) {
        console.log('ℹ️ No migrations to rollback');
        return;
      }
      
      console.log('⚠️ Rollback functionality requires manual intervention');
      console.log('📋 Executed migrations (most recent first):');
      
      executedMigrations.reverse().forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration}`);
      });
      
      console.log('\n💡 To rollback:');
      console.log('1. Create a new migration file with reverse operations');
      console.log('2. Run the migration normally');
      console.log('3. PostgreSQL doesn\'t support automatic rollbacks like some ORMs');
      
    } catch (error) {
      console.error('💥 Rollback check failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async status() {
    try {
      await this.connect();
      
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrations = await this.getMigrationFiles();
      
      console.log('\n📊 Migration Status:');
      console.log('===================');
      
      for (const migration of allMigrations) {
        const status = executedMigrations.includes(migration) ? '✅ APPLIED' : '⏳ PENDING';
        console.log(`${status}  ${migration}`);
      }
      
      const pendingCount = allMigrations.length - executedMigrations.length;
      console.log(`\n📋 Summary: ${executedMigrations.length} applied, ${pendingCount} pending`);
      
    } catch (error) {
      console.error('💥 Status check failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'migrate';
  const target = process.argv[3];
  
  const migrator = new DatabaseMigrator({});
  
  switch (command) {
    case 'migrate':
      migrator.migrate(target)
        .catch(error => {
          console.error('Migration failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'rollback':
      migrator.rollback(target)
        .catch(error => {
          console.error('Rollback failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'status':
      migrator.status()
        .catch(error => {
          console.error('Status check failed:', error.message);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Chess Stats Database Migrator');
      console.log('Usage:');
      console.log('  node scripts/migrate.js migrate [target_migration]');
      console.log('  node scripts/migrate.js rollback');
      console.log('  node scripts/migrate.js status');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/migrate.js migrate                    # Run all pending migrations');
      console.log('  node scripts/migrate.js migrate 001_initial_schema.sql  # Run up to specific migration');
      console.log('  node scripts/migrate.js status                     # Show migration status');
      break;
  }
}

module.exports = DatabaseMigrator;