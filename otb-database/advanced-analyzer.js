const fs = require('fs');
const path = require('path');
const PGNParser = require('./pgn-parser');

class AdvancedChessAnalyzer {
  constructor() {
    this.parser = new PGNParser();
    this.stats = {
      totalGames: 0,
      year2025Games: 0,
      
      // Result statistics
      results: {
        whiteWins: 0,
        blackWins: 0,
        draws: 0,
        whiteWinRate: 0,
        drawRate: 0,
        blackWinRate: 0
      },
      
      // Modern opening trends
      openingTrends: new Map(),
      openingByMonth: new Map(),
      
      // ELO brackets analysis
      eloBrackets: {
        'sub2000': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 },
        '2000-2200': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 },
        '2200-2400': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 },
        '2400-2600': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 },
        '2600-2700': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 },
        '2700+': { games: 0, whiteWins: 0, draws: 0, blackWins: 0 }
      },
      
      // Game length statistics
      gameLengths: {
        veryShort: 0,  // < 20 moves
        short: 0,      // 20-40 moves
        medium: 0,     // 40-60 moves
        long: 0,       // 60-80 moves
        veryLong: 0,   // 80+ moves
        totalMoves: 0,
        averageMoves: 0
      },
      
      // Player statistics
      topPlayers: new Map(),
      playerPerformance: new Map(),
      
      // Event/Tournament statistics
      events: new Map(),
      
      // First move statistics
      firstMoves: new Map(),
      
      // Decisive game factors
      decisiveGames: {
        total: 0,
        percentage: 0
      },
      
      // Modern trends (2025 specific)
      monthlyTrends: new Map(),
      
      // Popular opening sequences
      openingSequences: new Map(),
      
      // Upset statistics (lower rated wins)
      upsets: {
        total: 0,
        biggestUpset: null,
        averageRatingDiff: 0
      }
    };
  }

  getEloBracket(avgElo) {
    if (!avgElo) return null;
    if (avgElo < 2000) return 'sub2000';
    if (avgElo < 2200) return '2000-2200';
    if (avgElo < 2400) return '2200-2400';
    if (avgElo < 2600) return '2400-2600';
    if (avgElo < 2700) return '2600-2700';
    return '2700+';
  }

  extractMonth(dateStr) {
    if (!dateStr || dateStr === '????.??.??') return null;
    const parts = dateStr.split('.');
    if (parts[0] === '2025' && parts[1] !== '??') {
      return `2025-${parts[1].padStart(2, '0')}`;
    }
    return null;
  }

  async analyzeDatabase(filePath) {
    console.log('Starting advanced analysis of 2025 chess games...');
    
    await this.parser.parseFile(filePath, {
      onGame: (game) => {
        this.stats.totalGames++;
        
        // Check if it's a 2025 game
        if (game.date && game.date.startsWith('2025')) {
          this.stats.year2025Games++;
        }
        
        // Result statistics
        if (game.result === '1-0') {
          this.stats.results.whiteWins++;
        } else if (game.result === '0-1') {
          this.stats.results.blackWins++;
        } else if (game.result === '1/2-1/2') {
          this.stats.results.draws++;
        }
        
        // ELO bracket analysis
        if (game.whiteElo && game.blackElo) {
          const avgElo = Math.round((game.whiteElo + game.blackElo) / 2);
          const bracket = this.getEloBracket(avgElo);
          
          if (bracket && this.stats.eloBrackets[bracket]) {
            this.stats.eloBrackets[bracket].games++;
            if (game.result === '1-0') {
              this.stats.eloBrackets[bracket].whiteWins++;
            } else if (game.result === '0-1') {
              this.stats.eloBrackets[bracket].blackWins++;
            } else if (game.result === '1/2-1/2') {
              this.stats.eloBrackets[bracket].draws++;
            }
          }
          
          // Check for upsets
          if (game.result === '1-0' && game.blackElo > game.whiteElo + 200) {
            this.stats.upsets.total++;
            const ratingDiff = game.blackElo - game.whiteElo;
            if (!this.stats.upsets.biggestUpset || ratingDiff > this.stats.upsets.biggestUpset.ratingDiff) {
              this.stats.upsets.biggestUpset = {
                white: game.white,
                black: game.black,
                whiteElo: game.whiteElo,
                blackElo: game.blackElo,
                ratingDiff: ratingDiff,
                event: game.event,
                date: game.date
              };
            }
          } else if (game.result === '0-1' && game.whiteElo > game.blackElo + 200) {
            this.stats.upsets.total++;
            const ratingDiff = game.whiteElo - game.blackElo;
            if (!this.stats.upsets.biggestUpset || ratingDiff > this.stats.upsets.biggestUpset.ratingDiff) {
              this.stats.upsets.biggestUpset = {
                white: game.white,
                black: game.black,
                whiteElo: game.whiteElo,
                blackElo: game.blackElo,
                ratingDiff: ratingDiff,
                event: game.event,
                date: game.date
              };
            }
          }
        }
        
        // Opening trends
        if (game.eco) {
          const openingKey = `${game.eco}${game.opening ? ': ' + game.opening : ''}`;
          this.stats.openingTrends.set(
            openingKey,
            (this.stats.openingTrends.get(openingKey) || 0) + 1
          );
          
          // Track opening trends by month
          const month = this.extractMonth(game.date);
          if (month) {
            if (!this.stats.openingByMonth.has(month)) {
              this.stats.openingByMonth.set(month, new Map());
            }
            const monthOpenings = this.stats.openingByMonth.get(month);
            monthOpenings.set(game.eco, (monthOpenings.get(game.eco) || 0) + 1);
          }
        }
        
        // Game length statistics
        if (game.plyCount) {
          const moves = Math.floor(game.plyCount / 2);
          this.stats.gameLengths.totalMoves += moves;
          
          if (moves < 20) {
            this.stats.gameLengths.veryShort++;
          } else if (moves < 40) {
            this.stats.gameLengths.short++;
          } else if (moves < 60) {
            this.stats.gameLengths.medium++;
          } else if (moves < 80) {
            this.stats.gameLengths.long++;
          } else {
            this.stats.gameLengths.veryLong++;
          }
        }
        
        // Top players tracking
        [game.white, game.black].forEach(player => {
          if (player && player !== 'Unknown') {
            const playerStats = this.stats.topPlayers.get(player) || {
              games: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              avgRating: 0,
              totalRating: 0
            };
            
            playerStats.games++;
            
            if (player === game.white) {
              if (game.result === '1-0') playerStats.wins++;
              else if (game.result === '1/2-1/2') playerStats.draws++;
              else if (game.result === '0-1') playerStats.losses++;
              
              if (game.whiteElo) {
                playerStats.totalRating += game.whiteElo;
              }
            } else {
              if (game.result === '0-1') playerStats.wins++;
              else if (game.result === '1/2-1/2') playerStats.draws++;
              else if (game.result === '1-0') playerStats.losses++;
              
              if (game.blackElo) {
                playerStats.totalRating += game.blackElo;
              }
            }
            
            this.stats.topPlayers.set(player, playerStats);
          }
        });
        
        // Event statistics
        if (game.event && game.event !== 'Unknown') {
          const eventStats = this.stats.events.get(game.event) || {
            games: 0,
            avgElo: 0,
            totalElo: 0,
            draws: 0
          };
          
          eventStats.games++;
          if (game.result === '1/2-1/2') eventStats.draws++;
          
          if (game.whiteElo && game.blackElo) {
            eventStats.totalElo += (game.whiteElo + game.blackElo) / 2;
          }
          
          this.stats.events.set(game.event, eventStats);
        }
        
        // First move statistics
        if (game.moves) {
          const firstMove = game.moves.split(' ')[0];
          if (firstMove) {
            this.stats.firstMoves.set(
              firstMove,
              (this.stats.firstMoves.get(firstMove) || 0) + 1
            );
          }
          
          // Popular opening sequences (first 10 moves)
          const moveSequence = game.moves.split(' ').slice(0, 10).join(' ');
          if (moveSequence.length > 10) {
            this.stats.openingSequences.set(
              moveSequence,
              (this.stats.openingSequences.get(moveSequence) || 0) + 1
            );
          }
        }
        
        // Monthly trends
        const month = this.extractMonth(game.date);
        if (month) {
          const monthStats = this.stats.monthlyTrends.get(month) || {
            games: 0,
            whiteWins: 0,
            draws: 0,
            blackWins: 0,
            avgElo: 0,
            totalElo: 0
          };
          
          monthStats.games++;
          if (game.result === '1-0') monthStats.whiteWins++;
          else if (game.result === '0-1') monthStats.blackWins++;
          else if (game.result === '1/2-1/2') monthStats.draws++;
          
          if (game.whiteElo && game.blackElo) {
            monthStats.totalElo += (game.whiteElo + game.blackElo) / 2;
          }
          
          this.stats.monthlyTrends.set(month, monthStats);
        }
      }
    });
    
    // Calculate derived statistics
    this.calculateDerivedStats();
    
    return this.getFormattedStats();
  }
  
  calculateDerivedStats() {
    const total = this.stats.results.whiteWins + this.stats.results.blackWins + this.stats.results.draws;
    
    if (total > 0) {
      this.stats.results.whiteWinRate = ((this.stats.results.whiteWins / total) * 100).toFixed(2);
      this.stats.results.blackWinRate = ((this.stats.results.blackWins / total) * 100).toFixed(2);
      this.stats.results.drawRate = ((this.stats.results.draws / total) * 100).toFixed(2);
      
      this.stats.decisiveGames.total = this.stats.results.whiteWins + this.stats.results.blackWins;
      this.stats.decisiveGames.percentage = ((this.stats.decisiveGames.total / total) * 100).toFixed(2);
    }
    
    // Calculate average game length
    const totalLengthGames = this.stats.gameLengths.veryShort + this.stats.gameLengths.short + 
                            this.stats.gameLengths.medium + this.stats.gameLengths.long + 
                            this.stats.gameLengths.veryLong;
    if (totalLengthGames > 0) {
      this.stats.gameLengths.averageMoves = Math.round(this.stats.gameLengths.totalMoves / totalLengthGames);
    }
    
    // Calculate player averages
    this.stats.topPlayers.forEach((stats, player) => {
      if (stats.totalRating > 0 && stats.games > 0) {
        stats.avgRating = Math.round(stats.totalRating / stats.games);
      }
      stats.winRate = stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0';
      stats.performance = stats.games > 0 ? 
        (((stats.wins + stats.draws * 0.5) / stats.games) * 100).toFixed(1) : '0';
    });
    
    // Calculate event averages
    this.stats.events.forEach((stats, event) => {
      if (stats.totalElo > 0 && stats.games > 0) {
        stats.avgElo = Math.round(stats.totalElo / stats.games);
      }
      stats.drawRate = stats.games > 0 ? ((stats.draws / stats.games) * 100).toFixed(1) : '0';
    });
    
    // Calculate monthly averages
    this.stats.monthlyTrends.forEach((stats, month) => {
      if (stats.totalElo > 0 && stats.games > 0) {
        stats.avgElo = Math.round(stats.totalElo / stats.games);
      }
      stats.whiteWinRate = stats.games > 0 ? ((stats.whiteWins / stats.games) * 100).toFixed(1) : '0';
      stats.drawRate = stats.games > 0 ? ((stats.draws / stats.games) * 100).toFixed(1) : '0';
      stats.blackWinRate = stats.games > 0 ? ((stats.blackWins / stats.games) * 100).toFixed(1) : '0';
    });
  }
  
  getFormattedStats() {
    // Sort and limit results
    const topOpenings = Array.from(this.stats.openingTrends.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([opening, count]) => ({ opening, count, percentage: ((count / this.stats.totalGames) * 100).toFixed(2) }));
    
    const topPlayers = Array.from(this.stats.topPlayers.entries())
      .filter(([_, stats]) => stats.games >= 10)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 30)
      .map(([name, stats]) => ({ name, ...stats }));
    
    const topEvents = Array.from(this.stats.events.entries())
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 20)
      .map(([name, stats]) => ({ name, ...stats }));
    
    const firstMoves = Array.from(this.stats.firstMoves.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([move, count]) => ({ 
        move, 
        count, 
        percentage: ((count / this.stats.totalGames) * 100).toFixed(2) 
      }));
    
    const monthlyData = Array.from(this.stats.monthlyTrends.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({ month, ...stats }));
    
    const popularSequences = Array.from(this.stats.openingSequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sequence, count]) => ({ sequence, count }));
    
    return {
      overview: {
        totalGames: this.stats.totalGames,
        year2025Games: this.stats.year2025Games,
        percentageFrom2025: ((this.stats.year2025Games / this.stats.totalGames) * 100).toFixed(2)
      },
      results: this.stats.results,
      decisiveGames: this.stats.decisiveGames,
      eloBrackets: this.stats.eloBrackets,
      gameLengths: this.stats.gameLengths,
      topOpenings,
      topPlayers,
      topEvents,
      firstMoves,
      monthlyTrends: monthlyData,
      popularSequences,
      upsets: this.stats.upsets,
      modernInsights: {
        mostPopularOpening: topOpenings[0],
        mostActivePlayer: topPlayers[0],
        biggestEvent: topEvents[0],
        dominantFirstMove: firstMoves[0],
        averageGameLength: this.stats.gameLengths.averageMoves,
        decisiveGameRate: this.stats.decisiveGames.percentage + '%'
      }
    };
  }
}

module.exports = AdvancedChessAnalyzer;