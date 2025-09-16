const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

/**
 * Create user-related database tables
 */
class UserDatabaseSetup {
  constructor() {
    this.dbPath = path.join(__dirname, 'chess-stats.db');
  }

  async setupDatabase() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err);
          return reject(err);
        }
        
        console.log('✅ Connected to database');
        console.log('👤 Creating user tables...\n');

        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        const tables = [
          // Users table
          {
            name: 'users',
            sql: `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              display_name TEXT,
              avatar_url TEXT,
              rating INTEGER DEFAULT 1500,
              country TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_login DATETIME,
              is_active BOOLEAN DEFAULT 1,
              is_verified BOOLEAN DEFAULT 0,
              verification_token TEXT,
              reset_token TEXT,
              reset_token_expires DATETIME,
              preferences TEXT DEFAULT '{}',
              subscription_tier TEXT DEFAULT 'free',
              subscription_expires DATETIME
            )`
          },

          // User sessions table
          {
            name: 'user_sessions',
            sql: `CREATE TABLE IF NOT EXISTS user_sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token TEXT UNIQUE NOT NULL,
              refresh_token TEXT UNIQUE,
              ip_address TEXT,
              user_agent TEXT,
              expires_at DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // Favorite players table
          {
            name: 'favorite_players',
            sql: `CREATE TABLE IF NOT EXISTS favorite_players (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              player_name TEXT NOT NULL,
              platform TEXT DEFAULT 'chess.com',
              notes TEXT,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_checked DATETIME,
              notifications_enabled BOOLEAN DEFAULT 1,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
              UNIQUE(user_id, player_name, platform)
            )`
          },

          // Game collections table
          {
            name: 'game_collections',
            sql: `CREATE TABLE IF NOT EXISTS game_collections (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              is_public BOOLEAN DEFAULT 0,
              tags TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              game_count INTEGER DEFAULT 0,
              view_count INTEGER DEFAULT 0,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // Collection games table
          {
            name: 'collection_games',
            sql: `CREATE TABLE IF NOT EXISTS collection_games (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              collection_id INTEGER NOT NULL,
              game_id INTEGER,
              pgn TEXT,
              white_player TEXT,
              black_player TEXT,
              result TEXT,
              date TEXT,
              event TEXT,
              eco TEXT,
              opening TEXT,
              notes TEXT,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              position_order INTEGER,
              FOREIGN KEY (collection_id) REFERENCES game_collections (id) ON DELETE CASCADE
            )`
          },

          // Opening repertoire table
          {
            name: 'opening_repertoire',
            sql: `CREATE TABLE IF NOT EXISTS opening_repertoire (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              color TEXT CHECK(color IN ('white', 'black', 'both')),
              eco TEXT,
              opening_name TEXT NOT NULL,
              variation TEXT,
              pgn_moves TEXT,
              notes TEXT,
              confidence_level INTEGER DEFAULT 3 CHECK(confidence_level BETWEEN 1 AND 5),
              last_practiced DATETIME,
              times_played INTEGER DEFAULT 0,
              win_rate REAL DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User goals and progress table
          {
            name: 'user_goals',
            sql: `CREATE TABLE IF NOT EXISTS user_goals (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              goal_type TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              target_value INTEGER,
              current_value INTEGER DEFAULT 0,
              deadline DATETIME,
              status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'failed')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              completed_at DATETIME,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User activity log table
          {
            name: 'user_activity',
            sql: `CREATE TABLE IF NOT EXISTS user_activity (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              activity_type TEXT NOT NULL,
              activity_data TEXT,
              ip_address TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User notifications table
          {
            name: 'user_notifications',
            sql: `CREATE TABLE IF NOT EXISTS user_notifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              type TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT,
              data TEXT,
              is_read BOOLEAN DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              read_at DATETIME,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User study plans table
          {
            name: 'study_plans',
            sql: `CREATE TABLE IF NOT EXISTS study_plans (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              difficulty_level INTEGER DEFAULT 3 CHECK(difficulty_level BETWEEN 1 AND 5),
              estimated_hours INTEGER,
              completed_hours INTEGER DEFAULT 0,
              status TEXT DEFAULT 'not_started',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              started_at DATETIME,
              completed_at DATETIME,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User game analysis history
          {
            name: 'analysis_history',
            sql: `CREATE TABLE IF NOT EXISTS analysis_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              game_id INTEGER,
              pgn TEXT,
              analysis_data TEXT,
              engine_evaluation TEXT,
              accuracy_white REAL,
              accuracy_black REAL,
              blunders INTEGER DEFAULT 0,
              mistakes INTEGER DEFAULT 0,
              inaccuracies INTEGER DEFAULT 0,
              analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          },

          // User preferences table (detailed)
          {
            name: 'user_preferences',
            sql: `CREATE TABLE IF NOT EXISTS user_preferences (
              user_id INTEGER PRIMARY KEY,
              theme TEXT DEFAULT 'light',
              board_style TEXT DEFAULT 'default',
              piece_set TEXT DEFAULT 'default',
              sound_enabled BOOLEAN DEFAULT 1,
              email_notifications BOOLEAN DEFAULT 1,
              push_notifications BOOLEAN DEFAULT 0,
              language TEXT DEFAULT 'en',
              timezone TEXT DEFAULT 'UTC',
              default_time_control TEXT DEFAULT '10+0',
              auto_analysis BOOLEAN DEFAULT 0,
              show_coordinates BOOLEAN DEFAULT 1,
              show_legal_moves BOOLEAN DEFAULT 1,
              animation_speed TEXT DEFAULT 'normal',
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
          }
        ];

        // Create indexes for better performance
        const indexes = [
          'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
          'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_players(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_collections_user ON game_collections(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_collection_games ON collection_games(collection_id)',
          'CREATE INDEX IF NOT EXISTS idx_repertoire_user ON opening_repertoire(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_goals_user ON user_goals(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id, is_read)',
          'CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_analysis_user ON analysis_history(user_id)'
        ];

        let tablesCreated = 0;
        let indexesCreated = 0;

        // Create tables
        const createNextTable = (index) => {
          if (index >= tables.length) {
            // Create indexes after tables
            console.log('\n📇 Creating indexes...');
            createNextIndex(0);
            return;
          }

          const table = tables[index];
          console.log(`Creating table: ${table.name}`);
          
          db.run(table.sql, (err) => {
            if (err) {
              console.error(`❌ Error creating ${table.name}:`, err.message);
            } else {
              console.log(`✅ ${table.name} table ready`);
              tablesCreated++;
            }
            createNextTable(index + 1);
          });
        };

        // Create indexes
        const createNextIndex = (index) => {
          if (index >= indexes.length) {
            // Create sample data
            console.log('\n🌱 Creating sample data...');
            this.createSampleData(db, () => {
              console.log('\n' + '='.repeat(60));
              console.log('📊 DATABASE SETUP SUMMARY');
              console.log('='.repeat(60));
              console.log(`✅ Tables created: ${tablesCreated}/${tables.length}`);
              console.log(`✅ Indexes created: ${indexesCreated}/${indexes.length}`);
              console.log('\n✨ User database setup complete!');
              
              db.close();
              resolve();
            });
            return;
          }

          db.run(indexes[index], (err) => {
            if (err) {
              console.error(`❌ Error creating index:`, err.message);
            } else {
              indexesCreated++;
            }
            createNextIndex(index + 1);
          });
        };

        // Start creating tables
        createNextTable(0);
      });
    });
  }

  async createSampleData(db, callback) {
    // Create a demo user
    const demoPassword = await bcrypt.hash('demo123', 10);
    
    db.run(`
      INSERT OR IGNORE INTO users (username, email, password_hash, display_name, country, is_verified)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['demo_user', 'demo@chessstats.com', demoPassword, 'Demo User', 'US', 1], (err) => {
      if (err) {
        console.error('Error creating demo user:', err);
      } else {
        console.log('✅ Demo user created (username: demo_user, password: demo123)');
      }
      
      // Get the demo user ID
      db.get('SELECT id FROM users WHERE username = ?', ['demo_user'], (err, user) => {
        if (user) {
          // Add some sample data for the demo user
          const userId = user.id;
          
          // Add favorite players
          db.run(`
            INSERT OR IGNORE INTO favorite_players (user_id, player_name, platform, notes)
            VALUES (?, ?, ?, ?)
          `, [userId, 'MagnusCarlsen', 'chess.com', 'World Champion']);
          
          // Add a game collection
          db.run(`
            INSERT OR IGNORE INTO game_collections (user_id, name, description, is_public)
            VALUES (?, ?, ?, ?)
          `, [userId, 'My Best Games', 'Collection of my favorite games', 1]);
          
          // Add opening repertoire
          db.run(`
            INSERT OR IGNORE INTO opening_repertoire (user_id, color, eco, opening_name, variation, confidence_level)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [userId, 'white', 'B90', 'Sicilian Defense', 'Najdorf Variation', 4]);
          
          // Add a goal
          db.run(`
            INSERT OR IGNORE INTO user_goals (user_id, goal_type, title, description, target_value)
            VALUES (?, ?, ?, ?, ?)
          `, [userId, 'rating', 'Reach 2000 Rating', 'Improve my chess rating to 2000', 2000]);
          
          console.log('✅ Sample data created for demo user');
        }
        
        callback();
      });
    });
  }
}

// Run the setup
async function main() {
  const setup = new UserDatabaseSetup();
  
  try {
    console.log('🚀 Starting user database setup...\n');
    await setup.setupDatabase();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = UserDatabaseSetup;