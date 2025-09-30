const fs = require('fs');
const path = require('path');
const PGNParser = require('./pgn-parser');

class HistoricalChessAnalyzer {
  constructor() {
    this.parser = new PGNParser();
    this.stats = {
      totalGames: 0,
      databases: [],
      
      // Decade-based statistics
      decades: {
        '1970s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 },
        '1980s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 },
        '1990s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 },
        '2000s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 },
        '2010s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 },
        '2020s': { games: 0, whiteWins: 0, draws: 0, blackWins: 0, avgElo: 0, totalElo: 0 }
      },
      
      // Year-by-year statistics
      yearlyStats: new Map(),
      
      // Opening evolution
      openingEvolution: {
        '1970s': new Map(),
        '1980s': new Map(),
        '1990s': new Map(),
        '2000s': new Map(),
        '2010s': new Map(),
        '2020s': new Map()
      },
      
      // Draw rate evolution
      drawRateEvolution: new Map(),
      
      // Average game length evolution
      gameLengthEvolution: new Map(),
      
      // ELO inflation tracking
      eloProgression: new Map(),
      
      // Top players by decade
      playersByDecade: {
        '1970s': new Map(),
        '1980s': new Map(),
        '1990s': new Map(),
        '2000s': new Map(),
        '2010s': new Map(),
        '2020s': new Map()
      },
      
      // Opening popularity over time
      openingPopularity: new Map(),
      
      // Time control evolution (if available)
      timeControlEvolution: new Map(),
      
      // Tournament evolution
      tournamentEvolution: new Map(),
      
      // Chess engine impact (post-2000)
      engineEra: {
        preEngine: { games: 0, avgMoves: 0, drawRate: 0 }, // pre-2000
        earlyEngine: { games: 0, avgMoves: 0, drawRate: 0 }, // 2000-2010
        modernEngine: { games: 0, avgMoves: 0, drawRate: 0 } // 2010+
      },
      
      // Historical milestones
      milestones: [],
      
      // Data quality metrics
      dataQuality: {
        gamesWithElo: 0,
        gamesWithDate: 0,
        gamesWithOpening: 0,
        gamesWithMoves: 0,
        completeGames: 0
      }
    };
  }

  getDecade(year) {
    if (!year || year < 1970) return null;
    const decade = Math.floor(year / 10) * 10;
    if (decade === 1970) return '1970s';
    if (decade === 1980) return '1980s';
    if (decade === 1990) return '1990s';
    if (decade === 2000) return '2000s';
    if (decade === 2010) return '2010s';
    if (decade === 2020) return '2020s';
    return null;
  }

  getEngineEra(year) {
    if (!year) return null;
    if (year < 2000) return 'preEngine';
    if (year < 2010) return 'earlyEngine';
    return 'modernEngine';
  }

  async analyzeDatabase(filePath, databaseName = null) {
    const dbName = databaseName || path.basename(filePath, '.pgn');
    console.log(`Analyzing database: ${dbName}`);
    
    const dbStats = {
      name: dbName,
      games: 0,
      dateRange: { earliest: null, latest: null },
      avgElo: 0,
      totalElo: 0
    };
    
    await this.parser.parseFile(filePath, {
      onGame: (game) => {
        this.stats.totalGames++;
        dbStats.games++;
        
        // Extract year from date
        let year = null;
        if (game.date && game.date !== '????.??.??') {
          year = parseInt(game.date.split('.')[0]);
          
          // Update date range
          if (!dbStats.dateRange.earliest || year < dbStats.dateRange.earliest) {
            dbStats.dateRange.earliest = year;
          }
          if (!dbStats.dateRange.latest || year > dbStats.dateRange.latest) {
            dbStats.dateRange.latest = year;
          }
        }
        
        // Data quality tracking
        if (game.whiteElo && game.blackElo) this.stats.dataQuality.gamesWithElo++;
        if (game.date && game.date !== '????.??.??') this.stats.dataQuality.gamesWithDate++;
        if (game.eco || game.opening) this.stats.dataQuality.gamesWithOpening++;
        if (game.moves) this.stats.dataQuality.gamesWithMoves++;
        if (game.whiteElo && game.blackElo && game.date && game.moves) {
          this.stats.dataQuality.completeGames++;
        }
        
        // Decade-based analysis
        if (year) {
          const decade = this.getDecade(year);
          if (decade && this.stats.decades[decade]) {
            this.stats.decades[decade].games++;
            
            if (game.result === '1-0') {
              this.stats.decades[decade].whiteWins++;
            } else if (game.result === '0-1') {
              this.stats.decades[decade].blackWins++;
            } else if (game.result === '1/2-1/2') {
              this.stats.decades[decade].draws++;
            }
            
            if (game.whiteElo && game.blackElo) {
              const avgElo = (game.whiteElo + game.blackElo) / 2;
              this.stats.decades[decade].totalElo += avgElo;
              dbStats.totalElo += avgElo;
            }
            
            // Opening evolution
            if (game.eco) {
              const openingMap = this.stats.openingEvolution[decade];
              openingMap.set(game.eco, (openingMap.get(game.eco) || 0) + 1);
            }
            
            // Player tracking by decade
            const playerMap = this.stats.playersByDecade[decade];
            [game.white, game.black].forEach(player => {
              if (player && player !== 'Unknown') {
                const stats = playerMap.get(player) || { games: 0, wins: 0, avgElo: 0 };
                stats.games++;
                playerMap.set(player, stats);
              }
            });
          }
          
          // Yearly statistics
          if (!this.stats.yearlyStats.has(year)) {
            this.stats.yearlyStats.set(year, {
              games: 0,
              whiteWins: 0,
              draws: 0,
              blackWins: 0,
              avgElo: 0,
              totalElo: 0,
              avgMoves: 0,
              totalMoves: 0
            });
          }
          
          const yearStats = this.stats.yearlyStats.get(year);
          yearStats.games++;
          
          if (game.result === '1-0') yearStats.whiteWins++;
          else if (game.result === '0-1') yearStats.blackWins++;
          else if (game.result === '1/2-1/2') yearStats.draws++;
          
          if (game.whiteElo && game.blackElo) {
            yearStats.totalElo += (game.whiteElo + game.blackElo) / 2;
          }
          
          if (game.plyCount) {
            yearStats.totalMoves += Math.floor(game.plyCount / 2);
          }
          
          // Engine era analysis
          const era = this.getEngineEra(year);
          if (era && this.stats.engineEra[era]) {
            this.stats.engineEra[era].games++;
            if (game.plyCount) {
              this.stats.engineEra[era].avgMoves += Math.floor(game.plyCount / 2);
            }
            if (game.result === '1/2-1/2') {
              this.stats.engineEra[era].drawRate++;
            }
          }
        }
        
        // Overall opening popularity tracking
        if (game.eco && year) {
          const key = `${year}-${game.eco}`;
          if (!this.stats.openingPopularity.has(game.eco)) {
            this.stats.openingPopularity.set(game.eco, new Map());
          }
          const openingYears = this.stats.openingPopularity.get(game.eco);
          openingYears.set(year, (openingYears.get(year) || 0) + 1);
        }
        
        // Tournament evolution
        if (game.event && year) {
          if (!this.stats.tournamentEvolution.has(year)) {
            this.stats.tournamentEvolution.set(year, new Set());
          }
          this.stats.tournamentEvolution.get(year).add(game.event);
        }
      }
    });
    
    if (dbStats.totalElo > 0 && dbStats.games > 0) {
      dbStats.avgElo = Math.round(dbStats.totalElo / dbStats.games);
    }
    
    this.stats.databases.push(dbStats);
    console.log(`Completed analysis of ${dbName}: ${dbStats.games} games`);
  }

  async analyzeAllDatabases(directory) {
    const files = fs.readdirSync(directory);
    const pgnFiles = files.filter(f => f.endsWith('.pgn') || f.endsWith('.PGN'));
    
    console.log(`Found ${pgnFiles.length} PGN databases to analyze`);
    
    for (const file of pgnFiles) {
      const filePath = path.join(directory, file);
      await this.analyzeDatabase(filePath);
    }
    
    this.calculateDerivedStats();
    return this.getFormattedStats();
  }

  calculateDerivedStats() {
    // Calculate decade averages
    Object.keys(this.stats.decades).forEach(decade => {
      const decadeStats = this.stats.decades[decade];
      if (decadeStats.games > 0) {
        decadeStats.whiteWinRate = ((decadeStats.whiteWins / decadeStats.games) * 100).toFixed(2);
        decadeStats.drawRate = ((decadeStats.draws / decadeStats.games) * 100).toFixed(2);
        decadeStats.blackWinRate = ((decadeStats.blackWins / decadeStats.games) * 100).toFixed(2);
        
        if (decadeStats.totalElo > 0) {
          decadeStats.avgElo = Math.round(decadeStats.totalElo / decadeStats.games);
        }
      }
    });
    
    // Calculate yearly averages and evolution metrics
    this.stats.yearlyStats.forEach((stats, year) => {
      if (stats.games > 0) {
        // Draw rate evolution
        const drawRate = (stats.draws / stats.games) * 100;
        this.stats.drawRateEvolution.set(year, drawRate);
        
        // Average game length evolution
        if (stats.totalMoves > 0) {
          stats.avgMoves = Math.round(stats.totalMoves / stats.games);
          this.stats.gameLengthEvolution.set(year, stats.avgMoves);
        }
        
        // ELO progression
        if (stats.totalElo > 0) {
          stats.avgElo = Math.round(stats.totalElo / stats.games);
          this.stats.eloProgression.set(year, stats.avgElo);
        }
      }
    });
    
    // Calculate engine era statistics
    Object.keys(this.stats.engineEra).forEach(era => {
      const eraStats = this.stats.engineEra[era];
      if (eraStats.games > 0) {
        eraStats.avgMoves = Math.round(eraStats.avgMoves / eraStats.games);
        eraStats.drawRate = ((eraStats.drawRate / eraStats.games) * 100).toFixed(2);
      }
    });
    
    // Identify historical milestones
    this.identifyMilestones();
  }

  identifyMilestones() {
    const milestones = [];
    
    // Find highest average ELO year
    let highestEloYear = null;
    let highestElo = 0;
    this.stats.eloProgression.forEach((elo, year) => {
      if (elo > highestElo) {
        highestElo = elo;
        highestEloYear = year;
      }
    });
    
    if (highestEloYear) {
      milestones.push({
        year: highestEloYear,
        type: 'Highest Average ELO',
        value: highestElo,
        description: `Peak average rating of ${highestElo}`
      });
    }
    
    // Find highest draw rate year
    let highestDrawYear = null;
    let highestDrawRate = 0;
    this.stats.drawRateEvolution.forEach((rate, year) => {
      if (rate > highestDrawRate) {
        highestDrawRate = rate;
        highestDrawYear = year;
      }
    });
    
    if (highestDrawYear) {
      milestones.push({
        year: highestDrawYear,
        type: 'Highest Draw Rate',
        value: highestDrawRate.toFixed(2) + '%',
        description: `Peak draw rate of ${highestDrawRate.toFixed(2)}%`
      });
    }
    
    this.stats.milestones = milestones;
  }

  getFormattedStats() {
    // Sort and prepare data for visualization
    const yearlyData = Array.from(this.stats.yearlyStats.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, stats]) => ({ year, ...stats }));
    
    const drawRateData = Array.from(this.stats.drawRateEvolution.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, rate]) => ({ year, rate }));
    
    const gameLengthData = Array.from(this.stats.gameLengthEvolution.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, length]) => ({ year, avgMoves: length }));
    
    const eloData = Array.from(this.stats.eloProgression.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, elo]) => ({ year, avgElo: elo }));
    
    // Top openings by decade
    const openingsByDecade = {};
    Object.keys(this.stats.openingEvolution).forEach(decade => {
      const openings = Array.from(this.stats.openingEvolution[decade].entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([eco, count]) => ({ eco, count }));
      openingsByDecade[decade] = openings;
    });
    
    // Top players by decade
    const playersByDecade = {};
    Object.keys(this.stats.playersByDecade).forEach(decade => {
      const players = Array.from(this.stats.playersByDecade[decade].entries())
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 20)
        .map(([name, stats]) => ({ name, ...stats }));
      playersByDecade[decade] = players;
    });
    
    // Opening popularity timeline
    const openingTimelines = [];
    this.stats.openingPopularity.forEach((yearMap, eco) => {
      const timeline = Array.from(yearMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, count]) => ({ year, count }));
      
      if (timeline.length >= 10) { // Only include openings with significant history
        openingTimelines.push({
          eco,
          timeline,
          totalGames: timeline.reduce((sum, t) => sum + t.count, 0)
        });
      }
    });
    
    openingTimelines.sort((a, b) => b.totalGames - a.totalGames);
    
    return {
      overview: {
        totalGames: this.stats.totalGames,
        databases: this.stats.databases,
        dateRange: {
          earliest: Math.min(...this.stats.databases.map(d => d.dateRange.earliest).filter(Boolean)),
          latest: Math.max(...this.stats.databases.map(d => d.dateRange.latest).filter(Boolean))
        },
        dataQuality: {
          ...this.stats.dataQuality,
          completenessRate: ((this.stats.dataQuality.completeGames / this.stats.totalGames) * 100).toFixed(2) + '%'
        }
      },
      decades: this.stats.decades,
      yearlyStats: yearlyData,
      evolution: {
        drawRate: drawRateData,
        gameLength: gameLengthData,
        averageElo: eloData
      },
      openingsByDecade,
      playersByDecade,
      openingTimelines: openingTimelines.slice(0, 20),
      engineEra: this.stats.engineEra,
      milestones: this.stats.milestones,
      insights: this.generateInsights()
    };
  }

  generateInsights() {
    const insights = [];
    
    // Draw rate trend
    const recentDrawRates = Array.from(this.stats.drawRateEvolution.entries())
      .filter(([year, _]) => year >= 2010)
      .map(([_, rate]) => rate);
    
    const oldDrawRates = Array.from(this.stats.drawRateEvolution.entries())
      .filter(([year, _]) => year < 1990)
      .map(([_, rate]) => rate);
    
    if (recentDrawRates.length > 0 && oldDrawRates.length > 0) {
      const recentAvg = recentDrawRates.reduce((a, b) => a + b, 0) / recentDrawRates.length;
      const oldAvg = oldDrawRates.reduce((a, b) => a + b, 0) / oldDrawRates.length;
      
      insights.push({
        category: 'Draw Rate Evolution',
        finding: `Draw rate has ${recentAvg > oldAvg ? 'increased' : 'decreased'} from ${oldAvg.toFixed(1)}% (pre-1990) to ${recentAvg.toFixed(1)}% (post-2010)`,
        significance: Math.abs(recentAvg - oldAvg) > 5 ? 'high' : 'medium'
      });
    }
    
    // ELO inflation
    const eloYears = Array.from(this.stats.eloProgression.entries()).sort((a, b) => a[0] - b[0]);
    if (eloYears.length > 10) {
      const early = eloYears.slice(0, 5).map(([_, elo]) => elo);
      const recent = eloYears.slice(-5).map(([_, elo]) => elo);
      const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      
      insights.push({
        category: 'Rating Evolution',
        finding: `Average ratings have ${recentAvg > earlyAvg ? 'increased' : 'decreased'} by ${Math.abs(Math.round(recentAvg - earlyAvg))} points over the dataset period`,
        significance: Math.abs(recentAvg - earlyAvg) > 100 ? 'high' : 'medium'
      });
    }
    
    // Engine impact
    if (this.stats.engineEra.preEngine.games > 100 && this.stats.engineEra.modernEngine.games > 100) {
      const drawIncrease = parseFloat(this.stats.engineEra.modernEngine.drawRate) - parseFloat(this.stats.engineEra.preEngine.drawRate);
      
      insights.push({
        category: 'Computer Impact',
        finding: `The computer era has seen draw rates ${drawIncrease > 0 ? 'increase' : 'decrease'} by ${Math.abs(drawIncrease).toFixed(1)}%`,
        significance: Math.abs(drawIncrease) > 10 ? 'high' : 'medium'
      });
    }
    
    return insights;
  }
}

module.exports = HistoricalChessAnalyzer;