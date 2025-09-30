const fs = require('fs');
const path = require('path');

class IndexMerger {
  constructor() {
    this.tempDir = path.join(__dirname, 'indexes', 'temp');
    this.outputDir = path.join(__dirname, 'indexes');
    
    this.mergedData = {
      players: new Map(),
      events: new Map(),
      openings: new Map(),
      timeControls: new Map(),
      gameIds: new Set()
    };
    
    console.log('Starting index merge process...');
  }

  async mergeAllBatches() {
    const indexTypes = ['players', 'events', 'openings', 'timeControls', 'gameIds'];
    
    for (const type of indexTypes) {
      console.log(`\nMerging ${type} indexes...`);
      await this.mergeIndexType(type);
    }
    
    console.log('\n=== Saving final indexes ===');
    await this.saveFinalIndexes();
    
    console.log('\n=== Merge Complete ===');
    this.printStatistics();
  }

  async mergeIndexType(type) {
    const files = fs.readdirSync(this.tempDir)
      .filter(f => f.startsWith(`${type}-batch-`))
      .sort((a, b) => {
        const numA = parseInt(a.match(/batch-(\d+)/)[1]);
        const numB = parseInt(b.match(/batch-(\d+)/)[1]);
        return numA - numB;
      });
    
    console.log(`Found ${files.length} batch files for ${type}`);
    
    let processedBatches = 0;
    for (const file of files) {
      const filePath = path.join(this.tempDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (type === 'gameIds') {
        // For gameIds, just add to the set
        if (Array.isArray(data)) {
          data.forEach(id => this.mergedData.gameIds.add(id));
        }
      } else {
        // For other types, accumulate counts
        Object.entries(data).forEach(([key, count]) => {
          this.mergedData[type].set(key, 
            (this.mergedData[type].get(key) || 0) + count);
        });
      }
      
      processedBatches++;
      if (processedBatches % 10 === 0) {
        console.log(`  Processed ${processedBatches} batches...`);
      }
    }
    
    console.log(`  Total ${type} entries: ${
      type === 'gameIds' ? this.mergedData.gameIds.size : this.mergedData[type].size
    }`);
  }

  async saveFinalIndexes() {
    // Sort and save players by game count
    const playersSorted = Array.from(this.mergedData.players.entries())
      .sort((a, b) => b[1] - a[1]);
    
    await this.saveIndex('players-index', {
      totalPlayers: playersSorted.length,
      topPlayers: playersSorted.slice(0, 1000).map(([name, games]) => ({
        name,
        games
      })),
      allPlayers: Object.fromEntries(playersSorted)
    });
    
    // Sort and save events by game count
    const eventsSorted = Array.from(this.mergedData.events.entries())
      .sort((a, b) => b[1] - a[1]);
    
    await this.saveIndex('events-index', {
      totalEvents: eventsSorted.length,
      topEvents: eventsSorted.slice(0, 500).map(([name, games]) => ({
        name,
        games
      })),
      allEvents: Object.fromEntries(eventsSorted)
    });
    
    // Sort and save openings by frequency
    const openingsSorted = Array.from(this.mergedData.openings.entries())
      .sort((a, b) => b[1] - a[1]);
    
    await this.saveIndex('openings-index', {
      totalOpenings: openingsSorted.length,
      popularOpenings: openingsSorted.map(([name, count]) => ({
        name,
        count,
        percentage: (count / this.mergedData.gameIds.size * 100).toFixed(2)
      }))
    });
    
    // Save time controls
    const timeControlsSorted = Array.from(this.mergedData.timeControls.entries())
      .sort((a, b) => b[1] - a[1]);
    
    await this.saveIndex('timecontrols-index', {
      totalTimeControls: timeControlsSorted.length,
      distribution: timeControlsSorted.map(([type, count]) => ({
        type,
        count,
        percentage: (count / this.mergedData.gameIds.size * 100).toFixed(2)
      }))
    });
    
    // Save game IDs count (not the full list to save space)
    await this.saveIndex('games-summary', {
      totalGames: this.mergedData.gameIds.size,
      uniqueGames: this.mergedData.gameIds.size,
      indexCreated: new Date().toISOString()
    });
    
    // Create a master index file
    await this.saveIndex('master-index', {
      version: '1.0',
      created: new Date().toISOString(),
      statistics: {
        totalGames: this.mergedData.gameIds.size,
        totalPlayers: this.mergedData.players.size,
        totalEvents: this.mergedData.events.size,
        totalOpenings: this.mergedData.openings.size,
        timeControlTypes: this.mergedData.timeControls.size
      },
      files: [
        'players-index.json',
        'events-index.json',
        'openings-index.json',
        'timecontrols-index.json',
        'games-summary.json'
      ]
    });
  }

  async saveIndex(filename, data) {
    const filePath = path.join(this.outputDir, `${filename}.json`);
    
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
          console.error(`Error saving ${filename}:`, err);
          reject(err);
        } else {
          console.log(`  Saved: ${filename}.json`);
          resolve();
        }
      });
    });
  }

  printStatistics() {
    console.log('\n=== Final Statistics ===');
    console.log(`Total Games: ${this.mergedData.gameIds.size.toLocaleString()}`);
    console.log(`Total Players: ${this.mergedData.players.size.toLocaleString()}`);
    console.log(`Total Events: ${this.mergedData.events.size.toLocaleString()}`);
    console.log(`Total Opening Types: ${this.mergedData.openings.size.toLocaleString()}`);
    
    // Top players
    const topPlayers = Array.from(this.mergedData.players.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('\nTop 10 Players by Game Count:');
    topPlayers.forEach(([name, games], i) => {
      console.log(`  ${i + 1}. ${name}: ${games.toLocaleString()} games`);
    });
    
    // Opening distribution
    const openingStats = Array.from(this.mergedData.openings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log('\nTop 5 Openings:');
    openingStats.forEach(([name, count], i) => {
      const percentage = (count / this.mergedData.gameIds.size * 100).toFixed(2);
      console.log(`  ${i + 1}. ${name}: ${count.toLocaleString()} games (${percentage}%)`);
    });
    
    // Time control distribution
    console.log('\nTime Control Distribution:');
    Array.from(this.mergedData.timeControls.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = (count / this.mergedData.gameIds.size * 100).toFixed(2);
        console.log(`  ${type}: ${count.toLocaleString()} games (${percentage}%)`);
      });
  }
}

// Check if batch indexing is still running
const tempDir = path.join(__dirname, 'indexes', 'temp');
const batchFiles = fs.readdirSync(tempDir).filter(f => f.includes('-batch-'));

if (batchFiles.length === 0) {
  console.log('No batch files found. Please run the indexer first.');
  process.exit(1);
}

console.log(`Found ${batchFiles.length / 5} batches to merge`);
console.log('This may take a few minutes...\n');

// Run the merger
const merger = new IndexMerger();
merger.mergeAllBatches().catch(console.error);