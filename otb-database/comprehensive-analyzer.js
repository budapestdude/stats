const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ComprehensiveChessAnalyzer {
  constructor() {
    this.resetStats();
  }

  resetStats() {
    this.stats = {
      // Basic counts
      totalGames: 0,
      gamesWithElo: 0,
      gamesWithMoves: 0,
      
      // Time-based analysis
      yearlyStats: {},
      monthlyDistribution: Array(12).fill(0),
      quarterlyDistribution: Array(4).fill(0),
      dayOfWeekDistribution: Array(7).fill(0),
      
      // Rating analysis
      eloDistribution: {
        'under1200': 0,
        '1200-1400': 0,
        '1400-1600': 0,
        '1600-1800': 0,
        '1800-2000': 0,
        '2000-2200': 0,
        '2200-2400': 0,
        '2400-2600': 0,
        '2600-2800': 0,
        'over2800': 0
      },
      ratingGaps: {
        'equal': 0,         // 0-50 points
        'slight': 0,        // 50-100 points
        'moderate': 0,      // 100-200 points
        'significant': 0,   // 200-300 points
        'huge': 0          // 300+ points
      },
      
      // Game length analysis
      movesDistribution: {
        'veryShort': 0,    // 1-20 moves
        'short': 0,        // 21-40 moves
        'medium': 0,       // 41-60 moves
        'long': 0,         // 61-80 moves
        'veryLong': 0,     // 81-100 moves
        'marathon': 0      // 100+ moves
      },
      shortestGame: { moves: 999, game: null },
      longestGame: { moves: 0, game: null },
      
      // Result patterns
      resultsByRatingDiff: {
        favoriteWins: 0,    // Higher rated wins
        upsets: 0,          // Lower rated wins
        expectedDraws: 0,   // Draw with similar ratings
        surprisingDraws: 0  // Draw with big rating diff
      },
      resultsByColor: {
        white: { wins: 0, losses: 0, draws: 0 },
        black: { wins: 0, losses: 0, draws: 0 }
      },
      
      // Opening analysis
      openingFamilies: {},  // Group by first letter (A, B, C, D, E)
      openingDepth: {},     // Track ECO code lengths (B12 vs B12a vs B12a1)
      openingSuccess: {},   // Win rates per opening
      mostSuccessfulOpenings: { white: {}, black: {} },
      
      // Event/Tournament analysis
      events: {},
      eventTypes: {
        'World Championship': 0,
        'Olympiad': 0,
        'Open': 0,
        'Masters': 0,
        'Rapid': 0,
        'Blitz': 0,
        'Classical': 0,
        'Other': 0
      },
      
      // Player performance
      topPlayers: new Map(),
      playerRatings: new Map(),
      
      // Decade evolution
      decadeComparison: {},
      
      // Special patterns
      queenGambitGames: 0,
      sicilianGames: 0,
      frenchDefenseGames: 0,
      caroKannGames: 0,
      italianGames: 0,
      spanishGames: 0,
      
      // Endgame reaching rate
      endgameRate: 0,  // Games reaching move 40+
      
      // Time controls (if available)
      timeControls: {},
      
      // Geographic distribution (based on events)
      countries: {},
      
      // Decisive game rate by year
      decisiveRateByYear: {},
      
      // First move statistics
      firstMoves: {},
      
      // Castle statistics
      castlingPatterns: {
        'both_kingside': 0,
        'both_queenside': 0,
        'white_king_black_queen': 0,
        'white_queen_black_king': 0,
        'white_only': 0,
        'black_only': 0,
        'neither': 0
      }
    };
  }

  getEloCategory(elo) {
    if (!elo || elo < 1200) return 'under1200';
    if (elo < 1400) return '1200-1400';
    if (elo < 1600) return '1400-1600';
    if (elo < 1800) return '1600-1800';
    if (elo < 2000) return '1800-2000';
    if (elo < 2200) return '2000-2200';
    if (elo < 2400) return '2200-2400';
    if (elo < 2600) return '2400-2600';
    if (elo < 2800) return '2600-2800';
    return 'over2800';
  }

  getRatingGapCategory(diff) {
    const absDiff = Math.abs(diff);
    if (absDiff <= 50) return 'equal';
    if (absDiff <= 100) return 'slight';
    if (absDiff <= 200) return 'moderate';
    if (absDiff <= 300) return 'significant';
    return 'huge';
  }

  getMoveCategory(moves) {
    if (moves <= 20) return 'veryShort';
    if (moves <= 40) return 'short';
    if (moves <= 60) return 'medium';
    if (moves <= 80) return 'long';
    if (moves <= 100) return 'veryLong';
    return 'marathon';
  }

  extractMonth(dateStr) {
    if (!dateStr || dateStr === '????.??.??') return null;
    const parts = dateStr.split('.');
    if (parts[1] && parts[1] !== '??') {
      return parseInt(parts[1]) - 1; // 0-indexed
    }
    return null;
  }

  extractDayOfWeek(dateStr) {
    if (!dateStr || dateStr === '????.??.??' || dateStr.includes('??')) return null;
    const [year, month, day] = dateStr.split('.').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      return date.getDay();
    }
    return null;
  }

  categorizeEvent(eventName) {
    if (!eventName) return 'Other';
    const lower = eventName.toLowerCase();
    if (lower.includes('world') && lower.includes('champ')) return 'World Championship';
    if (lower.includes('olympiad')) return 'Olympiad';
    if (lower.includes('open')) return 'Open';
    if (lower.includes('masters')) return 'Masters';
    if (lower.includes('rapid')) return 'Rapid';
    if (lower.includes('blitz')) return 'Blitz';
    if (lower.includes('classical')) return 'Classical';
    return 'Other';
  }

  extractCountry(eventName) {
    // Simple extraction based on common patterns
    if (!eventName) return null;
    // Look for country codes or city names
    const matches = eventName.match(/\b([A-Z]{3})\b|\b([A-Z][a-z]+)\b$/);
    return matches ? matches[0] : null;
  }

  async analyzeFile(filePath, dbName) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = {};
      let localGames = 0;

      rl.on('line', (line) => {
        if (line.startsWith('[Event ')) {
          if (currentGame.date) {
            this.processGame(currentGame);
            localGames++;
            
            // Progress indicator
            if (localGames % 100000 === 0) {
              console.log(`  Processed ${localGames.toLocaleString()} games...`);
            }
          }
          currentGame = {};
        } else if (line.startsWith('[')) {
          const match = line.match(/\[(\w+)\s+"(.*)"\]/);
          if (match) {
            const [, key, value] = match;
            currentGame[key.toLowerCase()] = value;
          }
        } else if (line.trim() && !line.startsWith('[')) {
          // This is likely the moves
          currentGame.moves = (currentGame.moves || '') + ' ' + line.trim();
        }
      });

      rl.on('close', () => {
        // Process last game
        if (currentGame.date) {
          this.processGame(currentGame);
          localGames++;
        }

        console.log(`  Completed: ${localGames.toLocaleString()} games`);
        resolve();
      });

      rl.on('error', reject);
    });
  }

  processGame(game) {
    this.stats.totalGames++;

    // Extract year
    const year = this.extractYear(game.date);
    
    // Only process games from 1970 onwards for most stats
    if (year && year >= 1970) {
      // Yearly stats
      if (!this.stats.yearlyStats[year]) {
        this.stats.yearlyStats[year] = {
          games: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0,
          totalElo: 0,
          eloGames: 0,
          totalMoves: 0,
          moveGames: 0
        };
      }
      this.stats.yearlyStats[year].games++;

      // Monthly distribution
      const month = this.extractMonth(game.date);
      if (month !== null) {
        this.stats.monthlyDistribution[month]++;
        const quarter = Math.floor(month / 3);
        this.stats.quarterlyDistribution[quarter]++;
      }

      // Day of week
      const dayOfWeek = this.extractDayOfWeek(game.date);
      if (dayOfWeek !== null) {
        this.stats.dayOfWeekDistribution[dayOfWeek]++;
      }

      // Results
      if (game.result === '1-0') {
        this.stats.resultsByColor.white.wins++;
        this.stats.yearlyStats[year].whiteWins++;
      } else if (game.result === '0-1') {
        this.stats.resultsByColor.black.wins++;
        this.stats.yearlyStats[year].blackWins++;
      } else if (game.result === '1/2-1/2') {
        this.stats.resultsByColor.white.draws++;
        this.stats.resultsByColor.black.draws++;
        this.stats.yearlyStats[year].draws++;
      }

      // ELO analysis
      if (game.whiteelo && game.blackelo) {
        const whiteElo = parseInt(game.whiteelo);
        const blackElo = parseInt(game.blackelo);
        
        if (!isNaN(whiteElo) && !isNaN(blackElo)) {
          this.stats.gamesWithElo++;
          
          // Average ELO
          const avgElo = (whiteElo + blackElo) / 2;
          this.stats.yearlyStats[year].totalElo += avgElo;
          this.stats.yearlyStats[year].eloGames++;
          
          // ELO distribution
          this.stats.eloDistribution[this.getEloCategory(whiteElo)]++;
          this.stats.eloDistribution[this.getEloCategory(blackElo)]++;
          
          // Rating gap
          const ratingDiff = whiteElo - blackElo;
          this.stats.ratingGaps[this.getRatingGapCategory(ratingDiff)]++;
          
          // Result patterns by rating
          if (game.result === '1-0') {
            if (ratingDiff > 50) this.stats.resultsByRatingDiff.favoriteWins++;
            else if (ratingDiff < -50) this.stats.resultsByRatingDiff.upsets++;
          } else if (game.result === '0-1') {
            if (ratingDiff < -50) this.stats.resultsByRatingDiff.favoriteWins++;
            else if (ratingDiff > 50) this.stats.resultsByRatingDiff.upsets++;
          } else if (game.result === '1/2-1/2') {
            if (Math.abs(ratingDiff) < 100) this.stats.resultsByRatingDiff.expectedDraws++;
            else this.stats.resultsByRatingDiff.surprisingDraws++;
          }
        }
      }

      // Move count analysis
      if (game.plycount) {
        const moves = Math.floor(parseInt(game.plycount) / 2);
        if (!isNaN(moves) && moves > 0) {
          this.stats.gamesWithMoves++;
          this.stats.movesDistribution[this.getMoveCategory(moves)]++;
          
          this.stats.yearlyStats[year].totalMoves += moves;
          this.stats.yearlyStats[year].moveGames++;
          
          if (moves > 40) this.stats.endgameRate++;
          
          // Track shortest and longest
          if (moves < this.stats.shortestGame.moves) {
            this.stats.shortestGame = {
              moves,
              game: `${game.white} vs ${game.black} (${game.date})`
            };
          }
          if (moves > this.stats.longestGame.moves) {
            this.stats.longestGame = {
              moves,
              game: `${game.white} vs ${game.black} (${game.date})`
            };
          }
        }
      }

      // Opening analysis
      if (game.eco) {
        const family = game.eco[0]; // A, B, C, D, E
        this.stats.openingFamilies[family] = (this.stats.openingFamilies[family] || 0) + 1;
        
        // Opening depth
        const depth = game.eco.length;
        this.stats.openingDepth[depth] = (this.stats.openingDepth[depth] || 0) + 1;
        
        // Opening success rates
        if (!this.stats.openingSuccess[game.eco]) {
          this.stats.openingSuccess[game.eco] = { white: 0, black: 0, draws: 0, total: 0 };
        }
        this.stats.openingSuccess[game.eco].total++;
        if (game.result === '1-0') this.stats.openingSuccess[game.eco].white++;
        else if (game.result === '0-1') this.stats.openingSuccess[game.eco].black++;
        else if (game.result === '1/2-1/2') this.stats.openingSuccess[game.eco].draws++;
        
        // Special openings
        if (game.eco.startsWith('D06') || game.eco.startsWith('D07')) this.stats.queenGambitGames++;
        if (game.eco.startsWith('B2') || game.eco.startsWith('B3') || game.eco.startsWith('B4') || game.eco.startsWith('B5') || game.eco.startsWith('B6') || game.eco.startsWith('B7') || game.eco.startsWith('B8') || game.eco.startsWith('B9')) this.stats.sicilianGames++;
        if (game.eco.startsWith('C0') || game.eco.startsWith('C1')) this.stats.frenchDefenseGames++;
        if (game.eco.startsWith('B1')) this.stats.caroKannGames++;
        if (game.eco.startsWith('C5')) this.stats.italianGames++;
        if (game.eco.startsWith('C6') || game.eco.startsWith('C7') || game.eco.startsWith('C8') || game.eco.startsWith('C9')) this.stats.spanishGames++;
      }

      // Event analysis
      if (game.event) {
        this.stats.events[game.event] = (this.stats.events[game.event] || 0) + 1;
        const eventType = this.categorizeEvent(game.event);
        this.stats.eventTypes[eventType]++;
        
        const country = this.extractCountry(game.event);
        if (country) {
          this.stats.countries[country] = (this.stats.countries[country] || 0) + 1;
        }
      }

      // Player tracking
      [game.white, game.black].forEach(player => {
        if (player && player !== 'Unknown') {
          if (!this.stats.topPlayers.has(player)) {
            this.stats.topPlayers.set(player, { games: 0, wins: 0, draws: 0, losses: 0 });
          }
          this.stats.topPlayers.get(player).games++;
        }
      });

      // First move
      if (game.moves) {
        const firstMove = game.moves.trim().split(' ')[0];
        if (firstMove) {
          this.stats.firstMoves[firstMove] = (this.stats.firstMoves[firstMove] || 0) + 1;
        }
        
        // Castle detection (simplified)
        const moves = game.moves.toLowerCase();
        if (moves.includes('o-o') || moves.includes('0-0')) {
          if (moves.includes('o-o-o') || moves.includes('0-0-0')) {
            // Has queenside castling
            this.stats.castlingPatterns['both_queenside']++;
          } else {
            // Has kingside castling
            this.stats.castlingPatterns['both_kingside']++;
          }
        }
      }

      // Time control
      if (game.timecontrol && game.timecontrol !== '-') {
        this.stats.timeControls[game.timecontrol] = (this.stats.timeControls[game.timecontrol] || 0) + 1;
      }
    }
  }

  extractYear(dateStr) {
    if (!dateStr || dateStr === '????.??.??') return null;
    const year = parseInt(dateStr.split('.')[0]);
    return year > 1800 && year < 2030 ? year : null;
  }

  getFormattedStats() {
    // Calculate derived statistics
    const totalFrom1970 = Object.values(this.stats.yearlyStats).reduce((sum, y) => sum + y.games, 0);
    
    // Calculate yearly averages
    Object.keys(this.stats.yearlyStats).forEach(year => {
      const y = this.stats.yearlyStats[year];
      if (y.games > 0) {
        y.whiteWinRate = ((y.whiteWins / y.games) * 100).toFixed(2);
        y.blackWinRate = ((y.blackWins / y.games) * 100).toFixed(2);
        y.drawRate = ((y.draws / y.games) * 100).toFixed(2);
        y.decisiveRate = (((y.whiteWins + y.blackWins) / y.games) * 100).toFixed(2);
        
        if (y.eloGames > 0) {
          y.avgElo = Math.round(y.totalElo / y.eloGames);
        }
        if (y.moveGames > 0) {
          y.avgMoves = Math.round(y.totalMoves / y.moveGames);
        }
      }
    });
    
    // Top openings by success rate (minimum 1000 games)
    const openingSuccessRates = Object.entries(this.stats.openingSuccess)
      .filter(([_, stats]) => stats.total >= 1000)
      .map(([eco, stats]) => ({
        eco,
        total: stats.total,
        whiteScore: ((stats.white + stats.draws * 0.5) / stats.total * 100).toFixed(2),
        blackScore: ((stats.black + stats.draws * 0.5) / stats.total * 100).toFixed(2)
      }))
      .sort((a, b) => b.whiteScore - a.whiteScore);
    
    // Top events
    const topEvents = Object.entries(this.stats.events)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));
    
    // Top players
    const topPlayersList = Array.from(this.stats.topPlayers.entries())
      .filter(([_, stats]) => stats.games >= 100)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 50)
      .map(([name, stats]) => ({ name, ...stats }));
    
    // Most popular time controls
    const timeControlsList = Object.entries(this.stats.timeControls)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([control, count]) => ({ control, count }));
    
    // Monthly trends
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = this.stats.monthlyDistribution.map((count, i) => ({
      month: monthNames[i],
      games: count,
      percentage: ((count / totalFrom1970) * 100).toFixed(2)
    }));
    
    // Day of week trends
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyTrends = this.stats.dayOfWeekDistribution.map((count, i) => ({
      day: dayNames[i],
      games: count,
      percentage: ((count / totalFrom1970) * 100).toFixed(2)
    }));
    
    return {
      overview: {
        totalGames: this.stats.totalGames,
        gamesFrom1970: totalFrom1970,
        gamesWithElo: this.stats.gamesWithElo,
        gamesWithMoves: this.stats.gamesWithMoves,
        endgameRate: ((this.stats.endgameRate / this.stats.gamesWithMoves) * 100).toFixed(2) + '%'
      },
      
      timeAnalysis: {
        yearly: this.stats.yearlyStats,
        monthly: monthlyTrends,
        quarterly: this.stats.quarterlyDistribution.map((count, i) => ({
          quarter: `Q${i + 1}`,
          games: count,
          percentage: ((count / totalFrom1970) * 100).toFixed(2)
        })),
        weekday: weeklyTrends
      },
      
      ratingAnalysis: {
        distribution: this.stats.eloDistribution,
        gaps: this.stats.ratingGaps,
        resultsByRatingDiff: this.stats.resultsByRatingDiff
      },
      
      gameLength: {
        distribution: this.stats.movesDistribution,
        shortest: this.stats.shortestGame,
        longest: this.stats.longestGame
      },
      
      openingAnalysis: {
        families: this.stats.openingFamilies,
        depth: this.stats.openingDepth,
        topBySuccess: openingSuccessRates.slice(0, 20),
        popularOpenings: {
          queenGambit: this.stats.queenGambitGames,
          sicilian: this.stats.sicilianGames,
          french: this.stats.frenchDefenseGames,
          caroKann: this.stats.caroKannGames,
          italian: this.stats.italianGames,
          spanish: this.stats.spanishGames
        }
      },
      
      eventAnalysis: {
        types: this.stats.eventTypes,
        topEvents,
        countries: Object.entries(this.stats.countries)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([country, count]) => ({ country, count }))
      },
      
      players: {
        top50: topPlayersList
      },
      
      firstMoves: Object.entries(this.stats.firstMoves)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([move, count]) => ({ 
          move, 
          count,
          percentage: ((count / totalFrom1970) * 100).toFixed(2)
        })),
      
      timeControls: timeControlsList,
      
      castling: this.stats.castlingPatterns,
      
      insights: this.generateInsights()
    };
  }

  generateInsights() {
    const insights = [];
    const years = Object.keys(this.stats.yearlyStats).map(Number).sort((a, b) => a - b);
    
    if (years.length > 10) {
      // Growth rate
      const early = years.slice(0, 5);
      const recent = years.slice(-5);
      const earlyAvg = early.reduce((sum, y) => sum + this.stats.yearlyStats[y].games, 0) / early.length;
      const recentAvg = recent.reduce((sum, y) => sum + this.stats.yearlyStats[y].games, 0) / recent.length;
      const growthRate = ((recentAvg / earlyAvg - 1) * 100).toFixed(1);
      
      insights.push({
        category: 'Growth',
        finding: `Chess has grown ${growthRate}% from early ${early[0]}s to recent years`,
        significance: Math.abs(growthRate) > 100 ? 'high' : 'medium'
      });
      
      // Draw rate trend
      const earlyDrawRate = early.reduce((sum, y) => sum + parseFloat(this.stats.yearlyStats[y].drawRate || 0), 0) / early.length;
      const recentDrawRate = recent.reduce((sum, y) => sum + parseFloat(this.stats.yearlyStats[y].drawRate || 0), 0) / recent.length;
      
      insights.push({
        category: 'Draw Evolution',
        finding: `Draw rate has ${recentDrawRate > earlyDrawRate ? 'increased' : 'decreased'} from ${earlyDrawRate.toFixed(1)}% to ${recentDrawRate.toFixed(1)}%`,
        significance: Math.abs(recentDrawRate - earlyDrawRate) > 5 ? 'high' : 'medium'
      });
      
      // Peak year
      const peakYear = years.reduce((max, year) => 
        this.stats.yearlyStats[year].games > this.stats.yearlyStats[max].games ? year : max
      );
      
      insights.push({
        category: 'Peak Activity',
        finding: `${peakYear} was the most active year with ${this.stats.yearlyStats[peakYear].games.toLocaleString()} games`,
        significance: 'medium'
      });
    }
    
    // Opening trends
    const openingFamilies = Object.entries(this.stats.openingFamilies).sort((a, b) => b[1] - a[1]);
    if (openingFamilies.length > 0) {
      insights.push({
        category: 'Opening Preference',
        finding: `${openingFamilies[0][0]}-system openings are most popular (${((openingFamilies[0][1] / this.stats.totalGames) * 100).toFixed(1)}% of games)`,
        significance: 'medium'
      });
    }
    
    // Rating distribution insight
    const highRatedGames = (this.stats.eloDistribution['2400-2600'] + this.stats.eloDistribution['2600-2800'] + this.stats.eloDistribution['over2800']) || 0;
    const totalRatedPlayers = Object.values(this.stats.eloDistribution).reduce((sum, count) => sum + count, 0);
    if (totalRatedPlayers > 0) {
      const elitePercentage = ((highRatedGames / totalRatedPlayers) * 100).toFixed(2);
      insights.push({
        category: 'Elite Chess',
        finding: `${elitePercentage}% of games involve players rated 2400+`,
        significance: elitePercentage > 10 ? 'high' : 'medium'
      });
    }
    
    return insights;
  }
}

async function main() {
  console.log('Starting comprehensive historical analysis...');
  console.log('=' .repeat(60));
  
  const analyzer = new ComprehensiveChessAnalyzer();
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  const files = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn') || f.endsWith('.PGN'))
    .sort();
  
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
  console.log('Generating comprehensive statistics...');
  
  const stats = analyzer.getFormattedStats();
  
  // Save results
  const outputPath = path.join(__dirname, 'processed', 'comprehensive-stats.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  
  // Print summary
  console.log('=' .repeat(60));
  console.log('COMPREHENSIVE ANALYSIS COMPLETE');
  console.log('=' .repeat(60));
  console.log(`Total games analyzed: ${stats.overview.totalGames.toLocaleString()}`);
  console.log(`Games from 1970-2025: ${stats.overview.gamesFrom1970.toLocaleString()}`);
  console.log(`Games with ELO data: ${stats.overview.gamesWithElo.toLocaleString()}`);
  console.log(`Games reaching endgame: ${stats.overview.endgameRate}`);
  
  console.log('\nTop insights:');
  stats.insights.forEach(insight => {
    console.log(`  [${insight.category}] ${insight.finding}`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log('Results saved to:', outputPath);
  console.log('=' .repeat(60));
}

main().catch(console.error);