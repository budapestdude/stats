const fs = require('fs');
const readline = require('readline');
const path = require('path');

class EnhancedPlayerAnalyzer {
  constructor(playerName) {
    this.playerName = playerName;
    this.playerNameVariations = this.generateNameVariations(playerName);
    this.resetStats();
  }

  generateNameVariations(name) {
    const variations = new Set();
    variations.add(name);
    variations.add(name.toLowerCase());
    variations.add(name.toUpperCase());
    
    const parts = name.split(' ');
    if (parts.length === 2) {
      variations.add(`${parts[1]}, ${parts[0]}`);
      variations.add(`${parts[1]},${parts[0]}`);
      variations.add(`${parts[0].charAt(0)}. ${parts[1]}`);
      variations.add(`${parts[0][0]}${parts[1]}`);
    }
    
    return Array.from(variations);
  }

  resetStats() {
    this.stats = {
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      asWhite: { games: 0, wins: 0, draws: 0, losses: 0 },
      asBlack: { games: 0, wins: 0, draws: 0, losses: 0 },
      yearlyStats: {},
      openingsAsWhite: {},
      openingsAsBlack: {},
      opponents: {},
      opponentsDetailed: {}, // New: detailed opponent stats with time controls
      events: {},
      timeControls: {},
      timeControlCategories: {
        classical: { games: 0, wins: 0, draws: 0, losses: 0 },
        rapid: { games: 0, wins: 0, draws: 0, losses: 0 },
        blitz: { games: 0, wins: 0, draws: 0, losses: 0 },
        online: { games: 0, wins: 0, draws: 0, losses: 0 }
      },
      opponentRatings: {
        '2800+': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2700-2799': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2600-2699': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2500-2599': { games: 0, wins: 0, draws: 0, losses: 0 },
        '2400-2499': { games: 0, wins: 0, draws: 0, losses: 0 },
        'Under 2400': { games: 0, wins: 0, draws: 0, losses: 0 }
      },
      peakRating: { rating: 0, date: null, event: null },
      ratingProgression: [],
      firstGame: null,
      lastGame: null,
      longestWinStreak: 0,
      longestUnbeatenStreak: 0,
      currentWinStreak: 0,
      currentUnbeatenStreak: 0,
      gameLengths: {
        totalMoves: 0,
        gameCount: 0,
        shortest: { moves: 999, opponent: null, date: null },
        longest: { moves: 0, opponent: null, date: null }
      },
      vsTop10: { games: 0, wins: 0, draws: 0, losses: 0 },
      vsTop50: { games: 0, wins: 0, draws: 0, losses: 0 },
      notableVictories: []
    };
  }

  categorizeTimeControl(timeControl, eventName) {
    // Check event name first as it's often more reliable
    if (eventName) {
      const eventLower = eventName.toLowerCase();
      if (eventLower.includes('blitz') || eventLower.includes('bullet')) return 'blitz';
      if (eventLower.includes('rapid')) return 'rapid';
      if (eventLower.includes('online') || eventLower.includes('lichess') || 
          eventLower.includes('chess.com') || eventLower.includes('ficgs')) return 'online';
    }
    
    if (!timeControl || timeControl === '-') return 'classical';
    
    // Parse various time control formats
    // Format: "90+30" or "90m + 30s" or "3600+30" etc.
    const tcLower = timeControl.toLowerCase();
    
    // Handle formats with 'm' for minutes
    if (tcLower.includes('m')) {
      const minMatch = tcLower.match(/(\d+)m/);
      if (minMatch) {
        const minutes = parseInt(minMatch[1]);
        if (minutes < 10) return 'blitz';
        if (minutes < 60) return 'rapid';
        return 'classical';
      }
    }
    
    // Parse standard format (e.g., "300+0", "900+10", "180+2", "3600+30")
    const match = timeControl.match(/^(\d+)(?:\+(\d+))?/);
    if (match) {
      const baseTime = parseInt(match[1]);
      const increment = parseInt(match[2] || 0);
      
      // If baseTime > 100, it's likely in seconds
      // If baseTime <= 100, it's likely in minutes
      let totalSeconds;
      if (baseTime > 100) {
        // Time is in seconds
        totalSeconds = baseTime + (increment * 40);
      } else {
        // Time is in minutes
        totalSeconds = (baseTime * 60) + (increment * 40);
      }
      
      if (totalSeconds < 600) return 'blitz';        // < 10 minutes total
      if (totalSeconds < 1800) return 'rapid';       // < 30 minutes total
      return 'classical';                            // >= 30 minutes total
    }
    
    // Check for online platforms in time control
    if (tcLower.includes('online') || tcLower.includes('lichess') ||
        tcLower.includes('chess.com')) {
      return 'online';
    }
    
    // Default to classical for standard/unknown formats
    return 'classical';
  }

  extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})/);
    return match ? match[1] : null;
  }

  getOpponentRatingCategory(rating) {
    if (rating >= 2800) return '2800+';
    if (rating >= 2700) return '2700-2799';
    if (rating >= 2600) return '2600-2699';
    if (rating >= 2500) return '2500-2599';
    if (rating >= 2400) return '2400-2499';
    return 'Under 2400';
  }

  isPlayerGame(white, black) {
    for (const variation of this.playerNameVariations) {
      if (white && white.includes(variation)) return 'white';
      if (black && black.includes(variation)) return 'black';
    }
    return null;
  }

  processGame(game) {
    const playerColor = this.isPlayerGame(game.white, game.black);
    if (!playerColor) return;
    
    const isWhite = playerColor === 'white';
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
    
    // Time control categorization (pass event name for better detection)
    const timeCategory = this.categorizeTimeControl(game.timecontrol, game.event);
    const timeCategoryStats = this.stats.timeControlCategories[timeCategory];
    timeCategoryStats.games++;
    if (result === 'win') timeCategoryStats.wins++;
    else if (result === 'draw') timeCategoryStats.draws++;
    else timeCategoryStats.losses++;
    
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
    
    // Opponent analysis (both simple and detailed)
    const opponentName = isWhite ? game.black : game.white;
    const opponentElo = parseInt(isWhite ? game.blackelo : game.whiteelo);
    const playerElo = parseInt(isWhite ? game.whiteelo : game.blackelo);
    
    // Simple opponent tracking (for backward compatibility)
    if (opponentName) {
      if (!this.stats.opponents[opponentName]) {
        this.stats.opponents[opponentName] = { games: 0, wins: 0, draws: 0, losses: 0 };
      }
      this.stats.opponents[opponentName].games++;
      if (result === 'win') this.stats.opponents[opponentName].wins++;
      else if (result === 'draw') this.stats.opponents[opponentName].draws++;
      else this.stats.opponents[opponentName].losses++;
      
      // Detailed opponent tracking with time controls
      if (!this.stats.opponentsDetailed[opponentName]) {
        this.stats.opponentsDetailed[opponentName] = {
          total: { games: 0, wins: 0, draws: 0, losses: 0 },
          classical: { games: 0, wins: 0, draws: 0, losses: 0 },
          rapid: { games: 0, wins: 0, draws: 0, losses: 0 },
          blitz: { games: 0, wins: 0, draws: 0, losses: 0 },
          online: { games: 0, wins: 0, draws: 0, losses: 0 },
          avgRating: 0,
          totalRating: 0,
          ratedGames: 0,
          firstGame: game.date,
          lastGame: game.date
        };
      }
      
      const detailedOpp = this.stats.opponentsDetailed[opponentName];
      
      // Update total stats
      detailedOpp.total.games++;
      if (result === 'win') detailedOpp.total.wins++;
      else if (result === 'draw') detailedOpp.total.draws++;
      else detailedOpp.total.losses++;
      
      // Update time control specific stats
      const tcStats = detailedOpp[timeCategory];
      tcStats.games++;
      if (result === 'win') tcStats.wins++;
      else if (result === 'draw') tcStats.draws++;
      else tcStats.losses++;
      
      // Update opponent rating average
      if (!isNaN(opponentElo)) {
        detailedOpp.totalRating += opponentElo;
        detailedOpp.ratedGames++;
        detailedOpp.avgRating = Math.round(detailedOpp.totalRating / detailedOpp.ratedGames);
      }
      
      // Update date range
      if (game.date < detailedOpp.firstGame) detailedOpp.firstGame = game.date;
      if (game.date > detailedOpp.lastGame) detailedOpp.lastGame = game.date;
    }
    
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
          opening: game.eco,
          timeControl: timeCategory
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
      
      // Update average opponent rating for the year
      if (year && this.stats.yearlyStats[year]) {
        this.stats.yearlyStats[year].totalOpponentRating += opponentElo;
        this.stats.yearlyStats[year].ratedGames++;
      }
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

  async analyzeFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame = {};
    let gamesFound = 0;

    for await (const line of rl) {
      if (line.startsWith('[')) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          const [, key, value] = match;
          currentGame[key.toLowerCase()] = value;
        }
      } else if (line.trim() === '' && currentGame.white && currentGame.black) {
        if (this.isPlayerGame(currentGame.white, currentGame.black)) {
          this.processGame(currentGame);
          gamesFound++;
        }
        currentGame = {};
      }
    }

    // Process last game if exists
    if (currentGame.white && currentGame.black) {
      if (this.isPlayerGame(currentGame.white, currentGame.black)) {
        this.processGame(currentGame);
        gamesFound++;
      }
    }

    return gamesFound;
  }

  getStats() {
    const totalGames = this.stats.totalGames;
    
    // Calculate derived statistics
    const winRate = totalGames > 0 ? ((this.stats.wins / totalGames) * 100).toFixed(2) : '0';
    const drawRate = totalGames > 0 ? ((this.stats.draws / totalGames) * 100).toFixed(2) : '0';
    const lossRate = totalGames > 0 ? ((this.stats.losses / totalGames) * 100).toFixed(2) : '0';
    const performanceScore = totalGames > 0 ? 
      (((this.stats.wins + this.stats.draws * 0.5) / totalGames) * 100).toFixed(2) : '0';
    
    // Calculate yearly averages
    Object.keys(this.stats.yearlyStats).forEach(year => {
      const yearStats = this.stats.yearlyStats[year];
      if (yearStats.ratedGames > 0) {
        yearStats.avgOpponentRating = Math.round(yearStats.totalOpponentRating / yearStats.ratedGames);
      }
      yearStats.winRate = yearStats.games > 0 ? 
        ((yearStats.wins / yearStats.games) * 100).toFixed(1) : '0';
      yearStats.events = Array.from(yearStats.events);
    });
    
    // Format openings
    const sortOpenings = (openingsMap) => {
      return Object.entries(openingsMap)
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 15)
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
    
    // Format detailed opponents with time control breakdown
    const topOpponentsDetailed = Object.entries(this.stats.opponentsDetailed)
      .filter(([_, stats]) => stats.total.games >= 3)
      .sort((a, b) => b[1].total.games - a[1].total.games)
      .slice(0, 30)
      .map(([name, stats]) => ({
        name,
        ...stats,
        total: {
          ...stats.total,
          performanceScore: stats.total.games > 0 ?
            ((stats.total.wins + stats.total.draws * 0.5) / stats.total.games * 100).toFixed(1) : '0'
        },
        classical: {
          ...stats.classical,
          performanceScore: stats.classical.games > 0 ?
            ((stats.classical.wins + stats.classical.draws * 0.5) / stats.classical.games * 100).toFixed(1) : '0'
        },
        rapid: {
          ...stats.rapid,
          performanceScore: stats.rapid.games > 0 ?
            ((stats.rapid.wins + stats.rapid.draws * 0.5) / stats.rapid.games * 100).toFixed(1) : '0'
        },
        blitz: {
          ...stats.blitz,
          performanceScore: stats.blitz.games > 0 ?
            ((stats.blitz.wins + stats.blitz.draws * 0.5) / stats.blitz.games * 100).toFixed(1) : '0'
        },
        online: {
          ...stats.online,
          performanceScore: stats.online.games > 0 ?
            ((stats.online.wins + stats.online.draws * 0.5) / stats.online.games * 100).toFixed(1) : '0'
        }
      }));
    
    // Top events
    const topEvents = Object.entries(this.stats.events)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 15)
      .map(([event, stats]) => ({
        event,
        ...stats,
        winRate: stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0',
        performanceScore: stats.games > 0 ?
          ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(1) : '0'
      }));
    
    // Perfect events (100% score)
    const perfectEvents = Object.entries(this.stats.events)
      .filter(([_, stats]) => stats.games >= 5 && stats.losses === 0)
      .map(([event, stats]) => ({
        event,
        ...stats,
        score: `${stats.wins}/${stats.games}`
      }));
    
    // Average game length
    const avgGameLength = this.stats.gameLengths.gameCount > 0 ?
      Math.round(this.stats.gameLengths.totalMoves / this.stats.gameLengths.gameCount) : 0;
    
    // Calculate average opponent rating
    let totalOpponentRating = 0;
    let totalRatedGames = 0;
    Object.values(this.stats.yearlyStats).forEach(yearStats => {
      if (yearStats.ratedGames > 0) {
        totalOpponentRating += yearStats.totalOpponentRating;
        totalRatedGames += yearStats.ratedGames;
      }
    });
    const avgOpponentRating = totalRatedGames > 0 ? 
      Math.round(totalOpponentRating / totalRatedGames) : 0;
    
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
        decisiveGameRate: totalGames > 0 ? 
          (((this.stats.wins + this.stats.losses) / totalGames) * 100).toFixed(2) : '0'
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
      
      timeControlCategories: this.stats.timeControlCategories,
      
      yearlyStats: this.stats.yearlyStats,
      
      opponentRatings: Object.entries(this.stats.opponentRatings)
        .map(([category, stats]) => ({
          category,
          ...stats,
          performanceScore: stats.games > 0 ?
            ((stats.wins + stats.draws * 0.5) / stats.games * 100).toFixed(2) : '0'
        })),
      
      openingStats: {
        asWhite: sortOpenings(this.stats.openingsAsWhite),
        asBlack: sortOpenings(this.stats.openingsAsBlack)
      },
      
      opponentStats: topOpponents,
      opponentStatsDetailed: topOpponentsDetailed,
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
      
      peakRating: this.stats.peakRating.rating || 'N/A',
      avgOpponentRating,
      
      vsElite: {
        vsTop10: this.stats.vsTop10,
        vsTop50: this.stats.vsTop50
      },
      
      notableVictories: this.stats.notableVictories
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 20),
      
      firstGame: this.stats.firstGame,
      lastGame: this.stats.lastGame
    };
  }
}

async function analyzePlayer(playerName) {
  const analyzer = new EnhancedPlayerAnalyzer(playerName);
  const pgnDir = path.join(__dirname, 'pgn-files');
  const processedDir = path.join(__dirname, 'processed');
  
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const pgnFiles = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .sort();
  
  console.log(`Analyzing ${playerName} across ${pgnFiles.length} PGN files...`);
  
  for (const file of pgnFiles) {
    const filePath = path.join(pgnDir, file);
    const year = file.match(/\d{4}/)?.[0] || 'unknown';
    
    process.stdout.write(`Processing ${file}...`);
    const gamesFound = await analyzer.analyzeFile(filePath);
    
    if (gamesFound > 0) {
      console.log(` found ${gamesFound} games`);
    } else {
      process.stdout.write('\r');
    }
    
    console.log(`Found ${gamesFound} games for ${playerName}`);
  }
  
  const stats = analyzer.getStats();
  console.log(`\nTotal games for ${playerName}: ${stats.overview.totalGames}`);
  
  const outputPath = path.join(processedDir, `${playerName.toLowerCase().replace(/\s+/g, '-')}-enhanced-stats.json`);
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  console.log(`Enhanced stats saved to ${outputPath}`);
  
  return stats;
}

if (require.main === module) {
  analyzePlayer('Magnus Carlsen').catch(console.error);
}

module.exports = { EnhancedPlayerAnalyzer, analyzePlayer };