const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');

const streamPipeline = promisify(pipeline);

// Lumbras Gigabase download URLs (as of 2024)
// Note: These URLs need to be updated based on the actual download links from the website
const DOWNLOAD_SOURCES = {
  lumbras: {
    // These would need to be scraped or manually updated from the website
    '2024_tournaments': 'https://lumbrasgigabase.com/downloads/2024_tournaments.pgn.zip',
    '2023_complete': 'https://lumbrasgigabase.com/downloads/2023_complete.pgn.zip',
    'world_championships': 'https://lumbrasgigabase.com/downloads/world_championships.pgn.zip',
    'top_players': 'https://lumbrasgigabase.com/downloads/top_players.pgn.zip'
  },
  twic: {
    // The Week in Chess - recent games
    latest: 'https://theweekinchess.com/twic/latest.pgn'
  },
  pgnmentor: {
    // Historical games
    classics: 'http://www.pgnmentor.com/files/classics.pgn'
  }
};

class OTBDatabaseManager {
  constructor() {
    this.downloadDir = path.join(__dirname, 'pgn-files');
    this.processedDir = path.join(__dirname, 'processed');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.downloadDir, this.processedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async downloadFile(url, filename, onProgress) {
    const filePath = path.join(this.downloadDir, filename);
    
    console.log(`Downloading ${filename} from ${url}...`);
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Chess-Stats-OTB-Downloader/1.0'
        }
      });

      const totalLength = response.headers['content-length'];
      let downloadedLength = 0;

      response.data.on('data', (chunk) => {
        downloadedLength += chunk.length;
        if (onProgress && totalLength) {
          const progress = (downloadedLength / totalLength * 100).toFixed(2);
          onProgress(progress, downloadedLength, totalLength);
        }
      });

      await streamPipeline(response.data, fs.createWriteStream(filePath));
      
      console.log(`✅ Downloaded ${filename} successfully`);
      return filePath;
    } catch (error) {
      console.error(`❌ Failed to download ${filename}:`, error.message);
      throw error;
    }
  }

  async extractIfCompressed(filePath) {
    if (filePath.endsWith('.zip')) {
      // For ZIP files, we'd need to use a library like 'adm-zip' or 'unzipper'
      console.log('ZIP extraction not implemented yet. Please extract manually.');
      return null;
    } else if (filePath.endsWith('.gz')) {
      const outputPath = filePath.replace('.gz', '');
      console.log(`Extracting ${path.basename(filePath)}...`);
      
      await streamPipeline(
        fs.createReadStream(filePath),
        zlib.createGunzip(),
        fs.createWriteStream(outputPath)
      );
      
      console.log(`✅ Extracted to ${path.basename(outputPath)}`);
      return outputPath;
    }
    
    return filePath;
  }

  async downloadLumbrasDatabase() {
    // Since we can't directly download from Lumbras without authentication,
    // provide instructions for manual download
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  LUMBRAS GIGABASE DOWNLOAD                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Please manually download PGN files from:                         ║
║  https://lumbrasgigabase.com/en/download-in-pgn-format-en/       ║
║                                                                    ║
║  Recommended downloads:                                           ║
║  1. Recent tournaments (2023-2024)                               ║
║  2. World Championships collection                                ║
║  3. Top players games                                            ║
║  4. Classical games collection                                    ║
║                                                                    ║
║  Place downloaded files in:                                       ║
║  ${this.downloadDir}
║                                                                    ║
║  Supported formats: .pgn, .pgn.zip, .pgn.gz                      ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }

  async downloadTWIC() {
    // Download latest TWIC
    try {
      const twicUrl = 'https://theweekinchess.com/twic/latest.pgn';
      await this.downloadFile(twicUrl, 'twic_latest.pgn', (progress) => {
        process.stdout.write(`\rTWIC Download: ${progress}%`);
      });
      console.log('\n✅ TWIC latest games downloaded');
    } catch (error) {
      console.error('Failed to download TWIC:', error.message);
    }
  }

  async scanLocalFiles() {
    const files = fs.readdirSync(this.downloadDir);
    const pgnFiles = files.filter(f => 
      f.endsWith('.pgn') || 
      f.endsWith('.pgn.zip') || 
      f.endsWith('.pgn.gz')
    );
    
    console.log(`\nFound ${pgnFiles.length} PGN files in download directory:`);
    
    let totalGames = 0;
    for (const file of pgnFiles) {
      const filePath = path.join(this.downloadDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      // Estimate games (rough: ~2KB per game)
      const estimatedGames = Math.floor(stats.size / 2048);
      totalGames += estimatedGames;
      
      console.log(`  📁 ${file} (${sizeMB} MB, ~${estimatedGames.toLocaleString()} games)`);
    }
    
    console.log(`\nTotal estimated games: ${totalGames.toLocaleString()}`);
    return pgnFiles;
  }

  getAvailableFiles() {
    const files = fs.readdirSync(this.downloadDir);
    return files.filter(f => f.endsWith('.pgn')).map(f => ({
      filename: f,
      path: path.join(this.downloadDir, f),
      size: fs.statSync(path.join(this.downloadDir, f)).size
    }));
  }
}

// CLI interface
if (require.main === module) {
  const manager = new OTBDatabaseManager();
  
  const command = process.argv[2];
  
  switch(command) {
    case 'download':
      manager.downloadLumbrasDatabase();
      break;
    case 'twic':
      manager.downloadTWIC();
      break;
    case 'scan':
      manager.scanLocalFiles();
      break;
    default:
      console.log(`
Chess Stats OTB Database Manager

Commands:
  node download-manager.js download  - Show instructions for Lumbras download
  node download-manager.js twic      - Download latest TWIC games
  node download-manager.js scan      - Scan local PGN files
      `);
  }
}

module.exports = OTBDatabaseManager;