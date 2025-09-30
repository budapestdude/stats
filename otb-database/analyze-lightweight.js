const fs = require('fs');
const path = require('path');
const readline = require('readline');

class LightweightAnalyzer {
  constructor() {
    this.resetStats();
  }

  resetStats() {
    this.stats = {
      totalGames: 0,
      databases: [],
      decades: {},
      yearlyGames: {},
      results: { whiteWins: 0, blackWins: 0, draws: 0 },
      openingCounts: {},
      totalMoves: 0,
      gamesWithMoves: 0
    };
  }

  async analyzeFile(filePath, dbName) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = {};
      let localStats = {
        games: 0,
        earliest: 9999,
        latest: 0
      };

      rl.on('line', (line) => {
        if (line.startsWith('[Event ')) {
          if (currentGame.date) {
            // Process completed game
            this.processGame(currentGame);
            localStats.games++;
            
            const year = this.extractYear(currentGame.date);
            if (year) {
              localStats.earliest = Math.min(localStats.earliest, year);
              localStats.latest = Math.max(localStats.latest, year);
            }
          }
          currentGame = {};
        } else if (line.startsWith('[')) {
          const match = line.match(/\[(\w+)\s+"(.*)"\]/);
          if (match) {
            const [, key, value] = match;
            currentGame[key.toLowerCase()] = value;
          }
        }
      });

      rl.on('close', () => {
        // Process last game
        if (currentGame.date) {
          this.processGame(currentGame);
          localStats.games++;
        }

        this.stats.databases.push({
          name: dbName,
          games: localStats.games,
          dateRange: {
            earliest: localStats.earliest < 9999 ? localStats.earliest : null,
            latest: localStats.latest > 0 ? localStats.latest : null
          }
        });

        console.log(`  Processed ${localStats.games.toLocaleString()} games`);
        resolve();
      });

      rl.on('error', reject);
    });
  }

  extractYear(dateStr) {
    if (!dateStr || dateStr === '????.??.??') return null;
    const year = parseInt(dateStr.split('.')[0]);
    return year > 1800 && year < 2030 ? year : null;
  }

  processGame(game) {
    this.stats.totalGames++;

    // Year and decade tracking
    const year = this.extractYear(game.date);
    if (year) {
      // Track yearly games
      this.stats.yearlyGames[year] = (this.stats.yearlyGames[year] || 0) + 1;

      // Track by decade
      const decade = Math.floor(year / 10) * 10 + 's';
      if (!this.stats.decades[decade]) {
        this.stats.decades[decade] = {
          games: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0
        };
      }
      this.stats.decades[decade].games++;

      // Results by decade
      if (game.result === '1-0') {
        this.stats.decades[decade].whiteWins++;
        this.stats.results.whiteWins++;
      } else if (game.result === '0-1') {
        this.stats.decades[decade].blackWins++;
        this.stats.results.blackWins++;
      } else if (game.result === '1/2-1/2') {
        this.stats.decades[decade].draws++;
        this.stats.results.draws++;
      }
    }

    // Opening tracking (top 100 only to save memory)
    if (game.eco) {
      this.stats.openingCounts[game.eco] = (this.stats.openingCounts[game.eco] || 0) + 1;
      
      // Keep only top 100 openings in memory
      if (Object.keys(this.stats.openingCounts).length > 100) {
        const sorted = Object.entries(this.stats.openingCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 100);
        this.stats.openingCounts = Object.fromEntries(sorted);
      }
    }

    // Game length
    if (game.plycount) {
      const moves = parseInt(game.plycount) / 2;
      if (!isNaN(moves)) {
        this.stats.totalMoves += moves;
        this.stats.gamesWithMoves++;
      }
    }
  }

  getFormattedStats() {
    // Calculate percentages for decades
    Object.keys(this.stats.decades).forEach(decade => {
      const d = this.stats.decades[decade];
      if (d.games > 0) {
        d.whiteWinRate = ((d.whiteWins / d.games) * 100).toFixed(2);
        d.blackWinRate = ((d.blackWins / d.games) * 100).toFixed(2);
        d.drawRate = ((d.draws / d.games) * 100).toFixed(2);
      }
    });

    // Overall percentages
    const total = this.stats.totalGames;
    const resultPercentages = {
      whiteWinRate: ((this.stats.results.whiteWins / total) * 100).toFixed(2),
      blackWinRate: ((this.stats.results.blackWins / total) * 100).toFixed(2),
      drawRate: ((this.stats.results.draws / total) * 100).toFixed(2)
    };

    // Top openings
    const topOpenings = Object.entries(this.stats.openingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([eco, count]) => ({ eco, count, percentage: ((count / total) * 100).toFixed(2) }));

    // Yearly evolution data
    const yearlyEvolution = Object.entries(this.stats.yearlyGames)
      .sort((a, b) => a[0] - b[0])
      .map(([year, games]) => ({ year: parseInt(year), games }));

    // Average game length
    const avgGameLength = this.stats.gamesWithMoves > 0 
      ? Math.round(this.stats.totalMoves / this.stats.gamesWithMoves)
      : 0;

    return {
      overview: {
        totalGames: this.stats.totalGames,
        databases: this.stats.databases,
        dateRange: {
          earliest: Math.min(...Object.keys(this.stats.yearlyGames).map(Number)),
          latest: Math.max(...Object.keys(this.stats.yearlyGames).map(Number))
        }
      },
      decades: this.stats.decades,
      results: {
        ...this.stats.results,
        ...resultPercentages
      },
      topOpenings,
      yearlyEvolution,
      avgGameLength,
      summary: {
        totalDatabases: this.stats.databases.length,
        yearsSpanned: Object.keys(this.stats.yearlyGames).length,
        uniqueOpenings: Object.keys(this.stats.openingCounts).length,
        averageGamesPerYear: Math.round(this.stats.totalGames / Object.keys(this.stats.yearlyGames).length)
      }
    };
  }
}

async function main() {
  console.log('Starting lightweight historical analysis...');
  console.log('=' .repeat(60));
  
  const analyzer = new LightweightAnalyzer();
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  const files = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn') || f.endsWith('.PGN'))
    .sort(); // Process in order
  
  console.log(`Found ${files.length} PGN databases\n`);
  
  for (const file of files) {
    console.log(`Processing: ${file}`);
    const filePath = path.join(pgnDir, file);
    
    try {
      await analyzer.analyzeFile(filePath, file.replace('.pgn', '').replace('.PGN', ''));
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('Generating final statistics...');
  
  const stats = analyzer.getFormattedStats();
  
  // Save results
  const outputPath = path.join(__dirname, 'processed', 'historical-analysis.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save lightweight version for API
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  
  // Print summary
  console.log('=' .repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log('=' .repeat(60));
  console.log(`Total games analyzed: ${stats.overview.totalGames.toLocaleString()}`);
  console.log(`Date range: ${stats.overview.dateRange.earliest} - ${stats.overview.dateRange.latest}`);
  console.log(`Databases: ${stats.summary.totalDatabases}`);
  console.log(`Average game length: ${stats.avgGameLength} moves`);
  
  console.log('\nGames by decade:');
  Object.entries(stats.decades).forEach(([decade, data]) => {
    if (data.games > 0) {
      console.log(`  ${decade}: ${data.games.toLocaleString()} games`);
      console.log(`    White: ${data.whiteWinRate}%, Draw: ${data.drawRate}%, Black: ${data.blackWinRate}%`);
    }
  });
  
  console.log('\nTop 5 openings:');
  stats.topOpenings.slice(0, 5).forEach((opening, i) => {
    console.log(`  ${i + 1}. ${opening.eco}: ${opening.count.toLocaleString()} games (${opening.percentage}%)`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log('Results saved to:', outputPath);
  console.log('View at: http://localhost:3000/historical');
  console.log('=' .repeat(60));
}

main().catch(console.error);