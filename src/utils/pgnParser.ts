interface PGNGame {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string;
  whiteElo?: number;
  blackElo?: number;
  eco?: string;
  opening?: string;
  timeControl?: string;
  termination?: string;
  plyCount?: number;
  moves: string;
  headers: Record<string, string>;
}

export class PGNParser {
  static parse(pgn: string): PGNGame | PGNGame[] {
    const games = pgn.trim().split(/\n\n(?=\[)/);
    
    if (games.length === 1) {
      return this.parseSingleGame(games[0]);
    }
    
    return games.map(game => this.parseSingleGame(game));
  }

  private static parseSingleGame(pgnText: string): PGNGame {
    const lines = pgnText.trim().split('\n');
    const headers: Record<string, string> = {};
    let moves = '';
    let inMoves = false;

    for (const line of lines) {
      if (line.startsWith('[') && line.endsWith(']')) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      } else if (line.trim() && !line.startsWith('[')) {
        inMoves = true;
        moves += line + ' ';
      }
    }

    moves = this.cleanMoves(moves.trim());

    return {
      event: headers['Event'],
      site: headers['Site'],
      date: headers['Date'],
      round: headers['Round'],
      white: headers['White'],
      black: headers['Black'],
      result: headers['Result'],
      whiteElo: headers['WhiteElo'] ? parseInt(headers['WhiteElo']) : undefined,
      blackElo: headers['BlackElo'] ? parseInt(headers['BlackElo']) : undefined,
      eco: headers['ECO'],
      opening: headers['Opening'],
      timeControl: headers['TimeControl'],
      termination: headers['Termination'],
      plyCount: headers['PlyCount'] ? parseInt(headers['PlyCount']) : undefined,
      moves,
      headers,
    };
  }

  private static cleanMoves(moves: string): string {
    return moves
      .replace(/\{[^}]*\}/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\d+\.\.\./g, '')
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '')
      .trim();
  }

  static getMoveList(moves: string): string[] {
    const cleanMoves = this.cleanMoves(moves);
    const moveList: string[] = [];
    const tokens = cleanMoves.split(/\s+/);

    for (const token of tokens) {
      if (!token.match(/^\d+\./) && 
          token !== '1-0' && 
          token !== '0-1' && 
          token !== '1/2-1/2' &&
          token !== '*') {
        moveList.push(token);
      }
    }

    return moveList;
  }

  static getOpeningMoves(moves: string, numMoves = 10): string {
    const moveList = this.getMoveList(moves);
    return moveList.slice(0, numMoves * 2).join(' ');
  }

  static analyzePGN(pgn: string) {
    const game = Array.isArray(pgn) ? this.parse(pgn[0]) : this.parse(pgn);
    
    if (Array.isArray(game)) {
      return this.analyzeMultipleGames(game);
    }

    return this.analyzeSingleGame(game);
  }

  private static analyzeSingleGame(game: PGNGame) {
    const moveList = this.getMoveList(game.moves);
    const totalMoves = moveList.length;
    const plyCount = game.plyCount || totalMoves;

    return {
      players: {
        white: game.white,
        black: game.black,
        whiteElo: game.whiteElo,
        blackElo: game.blackElo,
      },
      result: game.result,
      opening: {
        eco: game.eco,
        name: game.opening,
        moves: this.getOpeningMoves(game.moves),
      },
      gameLength: {
        plyCount,
        moveCount: Math.ceil(plyCount / 2),
      },
      metadata: {
        event: game.event,
        site: game.site,
        date: game.date,
        timeControl: game.timeControl,
        termination: game.termination,
      },
    };
  }

  private static analyzeMultipleGames(games: PGNGame[]) {
    const stats = {
      totalGames: games.length,
      results: {
        whiteWins: 0,
        blackWins: 0,
        draws: 0,
      },
      averageGameLength: 0,
      averageRating: 0,
      openings: new Map<string, number>(),
      players: new Map<string, number>(),
    };

    let totalPlyCount = 0;
    let totalRating = 0;
    let ratingCount = 0;

    for (const game of games) {
      if (game.result === '1-0') stats.results.whiteWins++;
      else if (game.result === '0-1') stats.results.blackWins++;
      else if (game.result === '1/2-1/2') stats.results.draws++;

      if (game.plyCount) totalPlyCount += game.plyCount;

      if (game.whiteElo) {
        totalRating += game.whiteElo;
        ratingCount++;
      }
      if (game.blackElo) {
        totalRating += game.blackElo;
        ratingCount++;
      }

      if (game.eco) {
        stats.openings.set(game.eco, (stats.openings.get(game.eco) || 0) + 1);
      }

      if (game.white) {
        stats.players.set(game.white, (stats.players.get(game.white) || 0) + 1);
      }
      if (game.black) {
        stats.players.set(game.black, (stats.players.get(game.black) || 0) + 1);
      }
    }

    stats.averageGameLength = totalPlyCount / games.length;
    stats.averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    return {
      ...stats,
      topOpenings: Array.from(stats.openings.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topPlayers: Array.from(stats.players.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    };
  }

  static validatePGN(pgn: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const game = this.parse(pgn);
      const games = Array.isArray(game) ? game : [game];

      for (let i = 0; i < games.length; i++) {
        const g = games[i];
        
        if (!g.white || !g.black) {
          errors.push(`Game ${i + 1}: Missing player names`);
        }
        
        if (!g.result || !['1-0', '0-1', '1/2-1/2', '*'].includes(g.result)) {
          errors.push(`Game ${i + 1}: Invalid or missing result`);
        }
        
        if (!g.moves || g.moves.trim().length === 0) {
          errors.push(`Game ${i + 1}: No moves found`);
        }
      }
    } catch (error) {
      errors.push(`Parse error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static toPGN(game: Partial<PGNGame>): string {
    let pgn = '';

    const headers = [
      ['Event', game.event || '?'],
      ['Site', game.site || '?'],
      ['Date', game.date || '????.??.??'],
      ['Round', game.round || '?'],
      ['White', game.white || '?'],
      ['Black', game.black || '?'],
      ['Result', game.result || '*'],
    ];

    if (game.whiteElo) headers.push(['WhiteElo', game.whiteElo.toString()]);
    if (game.blackElo) headers.push(['BlackElo', game.blackElo.toString()]);
    if (game.eco) headers.push(['ECO', game.eco]);
    if (game.opening) headers.push(['Opening', game.opening]);
    if (game.timeControl) headers.push(['TimeControl', game.timeControl]);

    for (const [key, value] of headers) {
      pgn += `[${key} "${value}"]\n`;
    }

    pgn += '\n' + (game.moves || '') + ' ' + (game.result || '*');

    return pgn;
  }
}