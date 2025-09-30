const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PlayerAnalyzer {
  constructor(playerName) {
    this.playerName = playerName;
    this.playerNameVariations = this.generateNameVariations(playerName);
    this.resetStats();
  }

  generateNameVariations(name) {
    // Handle different name formats for Magnus Carlsen
    const variations = [name];
    if (name.toLowerCase().includes('carlsen')) {
      variations.push(
        'Carlsen, Magnus',
        'Magnus Carlsen',
        'Carlsen,Magnus',
        'Carlsen, M.',
        'Carlsen, M',
        'Carlsen,M',
        'Carlsen Magnus',
        'M. Carlsen',
        'M Carlsen'
      );
    }
    return variations.map(v => v.toLowerCase());
  }

  resetStats() {
    this.stats = {
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      
      // By color
      asWhite: { games: 0, wins: 0, draws: 0, losses: 0 },
      asBlack: { games: 0, wins: 0, draws: 0, losses: 0 },
      
      // By year
      yearlyStats: {},
      
      // By opponent rating
      opponentRatings: {
        'under2000': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2000-2200': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2200-2400': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2400-2600': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2600-2700': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2700-2800': { games: 0, wins: 0, draws: 0, losses: 0 },
        'over2800': { games: 0, wins: 0, draws: 0, losses: 0 }
      },
      
      // Opening repertoire
      openingsAsWhite: {},
      openingsAsBlack: {},
      
      // Opponents
      opponents: {},
      
      // Events/Tournaments
      events: {},
      
      // Game length
      gameLengths: {
        totalMoves: 0,
        gameCount: 0,
        shortest: { moves: 999, game: null },
        longest: { moves: 0, game: null }
      },
      
      // Performance rating
      performanceByYear: {},
      
      // Streaks
      longestWinStreak: 0,
      longestUnbeatenStreak: 0,
      currentWinStreak: 0,
      currentUnbeatenStreak: 0,
      
      // Rating progression
      ratingProgression: [],
      peakRating: { rating: 0, date: null },
      
      // Special achievements
      perfectEvents: [], // Events with 100% score
      
      // First and last games
      firstGame: null,
      lastGame: null,
      
      // Time controls
      timeControls: {},
      
      // Decisive game rate
      decisiveGameRate: 0,
      
      // Notable victories (2700+ opponents)
      notableVictories: [],
      
      // Performance vs top players
      vsTop10: { games: 0, wins: 0, draws: 0, losses: 0 },
      vsTop50: { games: 0, wins: 0, draws: 0, losses: 0 }
    };
  }

  matchesPlayer(name) {
    if (!name) return false;
    const normalized = name.toLowerCase();
    return this.playerNameVariations.some(variation => 
      normalized.includes(variation) || variation.includes(normalized)
    );
  }

  getOpponentRatingCategory(rating) {
    if (!rating || rating < 2000) return 'under2000';
    if (rating < 2200) return '2000-2200';
    if (rating < 2400) return '2200-2400';
    if (rating < 2600) return '2400-2600';
    if (rating < 2700) return '2600-2700';
    if (rating < 2800) return '2700-2800';
    return 'over2800';
  }

  extractYear(dateStr) {
    if (!dateStr || dateStr === '????.??.??') return null;
    const year = parseInt(dateStr.split('.')[0]);
    return year > 1990 && year < 2030 ? year : null;
  }

  async analyzeFile(filePath) {
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
          if (currentGame.white || currentGame.black) {
            // Check if this game involves our player
            const isWhite = this.matchesPlayer(currentGame.white);
            const isBlack = this.matchesPlayer(currentGame.black);
            
            if (isWhite || isBlack) {
              this.processGame(currentGame, isWhite);
              localGames++;
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
          currentGame.moves = (currentGame.moves || '') + ' ' + line.trim();
        }
      });

      rl.on('close', () => {
        // Process last game
        if (currentGame.white || currentGame.black) {
          const isWhite = this.matchesPlayer(currentGame.white);
          const isBlack = this.matchesPlayer(currentGame.black);
          
          if (isWhite || isBlack) {
            this.processGame(currentGame, isWhite);
            localGames++;
          }
        }
        
        console.log(`  Found ${localGames} games for ${this.playerName}`);
        resolve();
      });

      rl.on('error', reject);
    });
  }

  processGame(game, isWhite) {
    this.stats.totalGames++;
    
    // Track first and last games
    if (!this.stats.firstGame || (game.date && game.date < this.stats.firstGame.date)) {
      this.stats.firstGame = {
        date: game.date,
        event: game.event,
        opponent: isWhite ? game.black : game.white,
        result: game.result
      };
    }
    if (!this.stats.lastGame || (game.date && game.date > this.stats.lastGame.date)) {
      this.stats.lastGame = {
        date: game.date,
        event: game.event,
        opponent: isWhite ? game.black : game.white,
        result: game.result
      };
    }
    
    // Determine result from player's perspective
    let result = 'draw';
    if (game.result === '1-0') {
      result = isWhite ? 'win' : 'loss';
    } else if (game.result === '0-1') {
      result = isWhite ? 'loss' : 'win';
    }
    
    // Update overall stats
    if (result === 'win') {
      this.stats.wins++;
      this.stats.currentWinStreak++;
      this.stats.currentUnbeatenStreak++;
      if (this.stats.currentWinStreak > this.stats.longestWinStreak) {
        this.stats.longestWinStreak = this.stats.currentWinStreak;
      }
    } else if (result === 'draw') {
      this.stats.draws++;
      this.stats.currentWinStreak = 0;
      this.stats.currentUnbeatenStreak++;
    } else {
      this.stats.losses++;
      this.stats.currentWinStreak = 0;
      this.stats.currentUnbeatenStreak = 0;
    }
    
    if (this.stats.currentUnbeatenStreak > this.stats.longestUnbeatenStreak) {
      this.stats.longestUnbeatenStreak = this.stats.currentUnbeatenStreak;
    }
    
    // Update color-specific stats
    const colorStats = isWhite ? this.stats.asWhite : this.stats.asBlack;
    colorStats.games++;
    if (result === 'win') colorStats.wins++;
    else if (result === 'draw') colorStats.draws++;
    else colorStats.losses++;
    
    // Extract year and update yearly stats
    const year = this.extractYear(game.date);
    if (year) {
      if (!this.stats.yearlyStats[year]) {
        this.stats.yearlyStats[year] = {
          games: 0, wins: 0, draws: 0, losses: 0,
          avgOpponentRating: 0, totalOpponentRating: 0, ratedGames: 0,
          events: new Set()
        };
      }
      const yearStats = this.stats.yearlyStats[year];
      yearStats.games++;
      if (result === 'win') yearStats.wins++;
      else if (result === 'draw') yearStats.draws++;
      else yearStats.losses++;
      
      if (game.event) {
        yearStats.events.add(game.event);
      }
    }
    
    // Opponent analysis
    const opponentName = isWhite ? game.black : game.white;
    const opponentElo = parseInt(isWhite ? game.blackelo : game.whiteelo);
    const playerElo = parseInt(isWhite ? game.whiteelo : game.blackelo);
    
    if (!isNaN(opponentElo)) {
      // Opponent rating category
      const ratingCategory = this.getOpponentRatingCategory(opponentElo);
      this.stats.opponentRatings[ratingCategory].games++;
      if (result === 'win') this.stats.opponentRatings[ratingCategory].wins++;
      else if (result === 'draw') this.stats.opponentRatings[ratingCategory].draws++;
      else this.stats.opponentRatings[ratingCategory].losses++;
      
      // Notable victories
      if (result === 'win' && opponentElo >= 2700) {
        this.stats.notableVictories.push({
          opponent: opponentName,
          rating: opponentElo,
          date: game.date,
          event: game.event,
          opening: game.eco
        });
      }
      
      // Performance vs top players
      if (opponentElo >= 2750) {
        this.stats.vsTop10.games++;
        if (result === 'win') this.stats.vsTop10.wins++;
        else if (result === 'draw') this.stats.vsTop10.draws++;
        else this.stats.vsTop10.losses++;
      } else if (opponentElo >= 2700) {
        this.stats.vsTop50.games++;
        if (result === 'win') this.stats.vsTop50.wins++;
        else if (result === 'draw') this.stats.vsTop50.draws++;
        else this.stats.vsTop50.losses++;
      }
      
      // Update yearly opponent rating average
      if (year && this.stats.yearlyStats[year]) {
        this.stats.yearlyStats[year].totalOpponentRating += opponentElo;
        this.stats.yearlyStats[year].ratedGames++;
      }
    }
    
    // Track individual opponents
    if (opponentName) {
      if (!this.stats.opponents[opponentName]) {
        this.stats.opponents[opponentName] = { games: 0, wins: 0, draws: 0, losses: 0 };
      }
      this.stats.opponents[opponentName].games++;
      if (result === 'win') this.stats.opponents[opponentName].wins++;
      else if (result === 'draw') this.stats.opponents[opponentName].draws++;
      else this.stats.opponents[opponentName].losses++;
    }
    
    // Opening repertoire
    if (game.eco) {
      const openingMap = isWhite ? this.stats.openingsAsWhite : this.stats.openingsAsBlack;
      const openingKey = game.opening ? `${game.eco}: ${game.opening}` : game.eco;
      
      if (!openingMap[openingKey]) {
        openingMap[openingKey] = { games: 0, wins: 0, draws: 0, losses: 0 };
      }
      openingMap[openingKey].games++;
      if (result === 'win') openingMap[openingKey].wins++;
      else if (result === 'draw') openingMap[openingKey].draws++;
      else openingMap[openingKey].losses++;
    }
    
    // Events
    if (game.event) {
      if (!this.stats.events[game.event]) {
        this.stats.events[game.event] = { games: 0, wins: 0, draws: 0, losses: 0, year };
      }
      this.stats.events[game.event].games++;
      if (result === 'win') this.stats.events[game.event].wins++;
      else if (result === 'draw') this.stats.events[game.event].draws++;
      else this.stats.events[game.event].losses++;
    }
    
    // Game length
    if (game.plycount) {
      const moves = Math.floor(parseInt(game.plycount) / 2);
      if (!isNaN(moves) && moves > 0) {
        this.stats.gameLengths.totalMoves += moves;
        this.stats.gameLengths.gameCount++;
        
        if (moves < this.stats.gameLengths.shortest.moves) {
          this.stats.gameLengths.shortest = {
            moves,
            opponent: opponentName,
            date: game.date,
            result
          };
        }
        if (moves > this.stats.gameLengths.longest.moves) {
          this.stats.gameLengths.longest = {
            moves,
            opponent: opponentName,
            date: game.date,
            result
          };
        }
      }
    }
    
    // Rating progression
    if (!isNaN(playerElo) && year) {
      this.stats.ratingProgression.push({
        year,
        date: game.date,
        rating: playerElo,
        event: game.event
      });
      
      if (playerElo > this.stats.peakRating.rating) {
        this.stats.peakRating = {
          rating: playerElo,
          date: game.date,
          event: game.event
        };
      }
    }
    
    // Time control
    if (game.timecontrol && game.timecontrol !== '-') {
      if (!this.stats.timeControls[game.timecontrol]) {
        this.stats.timeControls[game.timecontrol] = { games: 0, wins: 0, draws: 0, losses: 0 };
      }
      this.stats.timeControls[game.timecontrol].games++;
      if (result === 'win') this.stats.timeControls[game.timecontrol].wins++;
      else if (result === 'draw') this.stats.timeControls[game.timecontrol].draws++;
      else this.stats.timeControls[game.timecontrol].losses++;
    }
  }

  getFormattedStats() {
    // Calculate derived statistics
    const totalGames = this.stats.totalGames;
    
    // Overall performance
    const winRate = totalGames > 0 ? ((this.stats.wins / totalGames) * 100).toFixed(2) : '0';
    const drawRate = totalGames > 0 ? ((this.stats.draws / totalGames) * 100).toFixed(2) : '0';
    const lossRate = totalGames > 0 ? ((this.stats.losses / totalGames) * 100).toFixed(2) : '0';
    
    // Performance score (1 point for win, 0.5 for draw)
    const performanceScore = totalGames > 0 ? 
      (((this.stats.wins + this.stats.draws * 0.5) / totalGames) * 100).toFixed(2) : '0';
    
    // Calculate yearly averages
    Object.keys(this.stats.yearlyStats).forEach(year => {
      const yearStats = this.stats.yearlyStats[year];
      if (yearStats.ratedGames > 0) {
        yearStats.avgOpponentRating = Math.round(yearStats.totalOpponentRating / yearStats.ratedGames);
      }
      yearStats.performanceScore = yearStats.games > 0 ?
        ((yearStats.wins + yearStats.draws * 0.5) / yearStats.games * 100).toFixed(1) : '0';
      yearStats.events = Array.from(yearStats.events);
    });
    
    // Sort openings by frequency
    const sortOpenings = (openingMap) => {
      return Object.entries(openingMap)
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 20)
        .map(([opening, stats]) => ({
          opening,
          ...stats,
          winRate: stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0',
          performanceScore: stats.games > 0 ? 
            ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(1) : '0'
        }));
    };
    
    // Sort opponents by games played
    const topOpponents = Object.entries(this.stats.opponents)
      .filter(([_, stats]) => stats.games >= 5)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 20)
      .map(([name, stats]) => ({
        name,
        ...stats,
        score: `+${stats.wins} =${stats.draws} -${stats.losses}`,
        performanceScore: stats.games > 0 ?
          ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(1) : '0'
      }));
    
    // Sort events by games
    const topEvents = Object.entries(this.stats.events)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 20)
      .map(([name, stats]) => ({
        name,
        ...stats,
        performanceScore: stats.games > 0 ?
          ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(1) : '0'
      }));
    
    // Find perfect events
    const perfectEvents = Object.entries(this.stats.events)
      .filter(([_, stats]) => stats.games >= 5 && stats.losses === 0 && stats.wins >= stats.games * 0.7)
      .map(([name, stats]) => ({ name, ...stats }));
    
    // Sort notable victories
    const notableVictories = this.stats.notableVictories
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);
    
    // Average game length
    const avgGameLength = this.stats.gameLengths.gameCount > 0 ?
      Math.round(this.stats.gameLengths.totalMoves / this.stats.gameLengths.gameCount) : 0;
    
    // Decisive game rate
    const decisiveGameRate = totalGames > 0 ?
      (((this.stats.wins + this.stats.losses) / totalGames) * 100).toFixed(2) : '0';
    
    return {
      player: this.playerName,
      overview: {
        totalGames,
        wins: this.stats.wins,
        draws: this.stats.draws,
        losses: this.stats.losses,
        winRate,
        drawRate,
        lossRate,
        performanceScore,
        decisiveGameRate
      },
      
      byColor: {
        white: {
          ...this.stats.asWhite,
          winRate: this.stats.asWhite.games > 0 ?
            ((this.stats.asWhite.wins / this.stats.asWhite.games) * 100).toFixed(2) : '0',
          performanceScore: this.stats.asWhite.games > 0 ?
            ((this.stats.asWhite.wins + this.stats.asWhite.draws * 0.5) / this.stats.asWhite.games * 100).toFixed(2) : '0'
        },
        black: {
          ...this.stats.asBlack,
          winRate: this.stats.asBlack.games > 0 ?
            ((this.stats.asBlack.wins / this.stats.asBlack.games) * 100).toFixed(2) : '0',
          performanceScore: this.stats.asBlack.games > 0 ?
            ((this.stats.asBlack.wins + this.stats.asBlack.draws * 0.5) / this.stats.asBlack.games * 100).toFixed(2) : '0'
        }
      },
      
      yearlyStats: this.stats.yearlyStats,
      
      opponentRatings: Object.entries(this.stats.opponentRatings)
        .map(([category, stats]) => ({
          category,
          ...stats,
          performanceScore: stats.games > 0 ?
            ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(2) : '0'
        })),
      
      openings: {
        asWhite: sortOpenings(this.stats.openingsAsWhite),
        asBlack: sortOpenings(this.stats.openingsAsBlack)
      },
      
      topOpponents,
      topEvents,
      perfectEvents,
      
      gameLength: {
        average: avgGameLength,
        shortest: this.stats.gameLengths.shortest,
        longest: this.stats.gameLengths.longest
      },
      
      streaks: {
        longestWinStreak: this.stats.longestWinStreak,
        longestUnbeatenStreak: this.stats.longestUnbeatenStreak
      },
      
      peakRating: this.stats.peakRating,
      
      vsElite: {
        vsTop10: this.stats.vsTop10,
        vsTop50: this.stats.vsTop50
      },
      
      notableVictories,
      
      career: {
        firstGame: this.stats.firstGame,
        lastGame: this.stats.lastGame,
        yearsActive: Object.keys(this.stats.yearlyStats).length
      }
    };
  }
}

async function analyzePlayer(playerName) {
  console.log(`\nAnalyzing ${playerName}'s OTB games...`);
  console.log('=' .repeat(60));
  
  const analyzer = new PlayerAnalyzer(playerName);
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  const files = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn') || f.endsWith('.PGN'))
    .sort();
  
  console.log(`Searching through ${files.length} databases...\n`);
  
  for (const file of files) {
    console.log(`Scanning: ${file}`);
    const filePath = path.join(pgnDir, file);
    
    try {
      await analyzer.analyzeFile(filePath);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  const stats = analyzer.getFormattedStats();
  
  // Save results
  const outputPath = path.join(__dirname, 'processed', `${playerName.toLowerCase().replace(/\s+/g, '-')}-stats.json`);
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log(`ANALYSIS COMPLETE: ${playerName}`);
  console.log('=' .repeat(60));
  console.log(`Total games: ${stats.overview.totalGames}`);
  console.log(`Record: +${stats.overview.wins} =${stats.overview.draws} -${stats.overview.losses}`);
  console.log(`Win rate: ${stats.overview.winRate}%`);
  console.log(`Performance score: ${stats.overview.performanceScore}%`);
  console.log(`Peak rating: ${stats.peakRating.rating} (${stats.peakRating.date})`);
  console.log(`Years active: ${stats.career.yearsActive}`);
  console.log(`First game: ${stats.career.firstGame?.date || 'N/A'}`);
  console.log(`Last game: ${stats.career.lastGame?.date || 'N/A'}`);
  
  console.log('\n' + '=' .repeat(60));
  console.log(`Results saved to: ${outputPath}`);
  console.log('=' .repeat(60));
  
  return stats;
}

// Run analysis for Magnus Carlsen
if (require.main === module) {
  analyzePlayer('Magnus Carlsen').catch(console.error);
}

module.exports = { PlayerAnalyzer, analyzePlayer };