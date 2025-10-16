const logger = require('./logger');

/**
 * Query Builder for optimized SQL generation
 * Provides a fluent API for building complex queries
 */
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.selectFields = ['*'];
    this.whereConditions = [];
    this.joinClauses = [];
    this.orderByFields = [];
    this.groupByFields = [];
    this.havingConditions = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.distinctFlag = false;
    this.params = [];
  }

  /**
   * Select specific fields
   */
  select(...fields) {
    this.selectFields = fields.length > 0 ? fields : ['*'];
    return this;
  }

  /**
   * Add DISTINCT
   */
  distinct() {
    this.distinctFlag = true;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(field, operator, value) {
    if (arguments.length === 2) {
      // Simple equality: where('field', 'value')
      value = operator;
      operator = '=';
    }
    
    this.whereConditions.push({
      type: 'AND',
      field,
      operator,
      value
    });
    
    if (value !== null && value !== undefined) {
      this.params.push(value);
    }
    
    return this;
  }

  /**
   * Add OR WHERE condition
   */
  orWhere(field, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    
    this.whereConditions.push({
      type: 'OR',
      field,
      operator,
      value
    });
    
    if (value !== null && value !== undefined) {
      this.params.push(value);
    }
    
    return this;
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(field, values) {
    const placeholders = values.map(() => '?').join(', ');
    
    this.whereConditions.push({
      type: 'AND',
      raw: `${field} IN (${placeholders})`
    });
    
    this.params.push(...values);
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   */
  whereNotIn(field, values) {
    const placeholders = values.map(() => '?').join(', ');
    
    this.whereConditions.push({
      type: 'AND',
      raw: `${field} NOT IN (${placeholders})`
    });
    
    this.params.push(...values);
    return this;
  }

  /**
   * Add WHERE BETWEEN condition
   */
  whereBetween(field, min, max) {
    this.whereConditions.push({
      type: 'AND',
      raw: `${field} BETWEEN ? AND ?`
    });
    
    this.params.push(min, max);
    return this;
  }

  /**
   * Add WHERE LIKE condition
   */
  whereLike(field, pattern) {
    this.whereConditions.push({
      type: 'AND',
      field,
      operator: 'LIKE',
      value: pattern
    });
    
    this.params.push(pattern);
    return this;
  }

  /**
   * Add WHERE NULL condition
   */
  whereNull(field) {
    this.whereConditions.push({
      type: 'AND',
      raw: `${field} IS NULL`
    });
    
    return this;
  }

  /**
   * Add WHERE NOT NULL condition
   */
  whereNotNull(field) {
    this.whereConditions.push({
      type: 'AND',
      raw: `${field} IS NOT NULL`
    });
    
    return this;
  }

  /**
   * Add raw WHERE condition
   */
  whereRaw(sql, params = []) {
    this.whereConditions.push({
      type: 'AND',
      raw: sql
    });
    
    this.params.push(...params);
    return this;
  }

  /**
   * Add JOIN clause
   */
  join(table, field1, operator, field2) {
    if (arguments.length === 3) {
      field2 = operator;
      operator = '=';
    }
    
    this.joinClauses.push({
      type: 'INNER',
      table,
      condition: `${field1} ${operator} ${field2}`
    });
    
    return this;
  }

  /**
   * Add LEFT JOIN clause
   */
  leftJoin(table, field1, operator, field2) {
    if (arguments.length === 3) {
      field2 = operator;
      operator = '=';
    }
    
    this.joinClauses.push({
      type: 'LEFT',
      table,
      condition: `${field1} ${operator} ${field2}`
    });
    
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field, direction = 'ASC') {
    this.orderByFields.push({
      field,
      direction: direction.toUpperCase()
    });
    
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(...fields) {
    this.groupByFields.push(...fields);
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(field, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    
    this.havingConditions.push({
      field,
      operator,
      value
    });
    
    this.params.push(value);
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(value) {
    this.limitValue = value;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(value) {
    this.offsetValue = value;
    return this;
  }

  /**
   * Pagination helper
   */
  paginate(page, perPage = 20) {
    const offset = (page - 1) * perPage;
    return this.limit(perPage).offset(offset);
  }

  /**
   * Build WHERE clause
   */
  buildWhereClause() {
    if (this.whereConditions.length === 0) {
      return '';
    }
    
    let whereClause = ' WHERE ';
    let first = true;
    
    for (const condition of this.whereConditions) {
      if (!first) {
        whereClause += ` ${condition.type} `;
      }
      
      if (condition.raw) {
        whereClause += condition.raw;
      } else {
        whereClause += `${condition.field} ${condition.operator} ?`;
      }
      
      first = false;
    }
    
    return whereClause;
  }

  /**
   * Build JOIN clauses
   */
  buildJoinClause() {
    if (this.joinClauses.length === 0) {
      return '';
    }
    
    return this.joinClauses
      .map(join => ` ${join.type} JOIN ${join.table} ON ${join.condition}`)
      .join('');
  }

  /**
   * Build the complete SQL query
   */
  build() {
    let sql = 'SELECT ';
    
    // DISTINCT
    if (this.distinctFlag) {
      sql += 'DISTINCT ';
    }
    
    // SELECT fields
    sql += this.selectFields.join(', ');
    
    // FROM
    sql += ` FROM ${this.table}`;
    
    // JOINs
    sql += this.buildJoinClause();
    
    // WHERE
    sql += this.buildWhereClause();
    
    // GROUP BY
    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }
    
    // HAVING
    if (this.havingConditions.length > 0) {
      sql += ' HAVING ';
      sql += this.havingConditions
        .map(h => `${h.field} ${h.operator} ?`)
        .join(' AND ');
    }
    
    // ORDER BY
    if (this.orderByFields.length > 0) {
      sql += ' ORDER BY ';
      sql += this.orderByFields
        .map(o => `${o.field} ${o.direction}`)
        .join(', ');
    }
    
    // LIMIT & OFFSET
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    
    logger.debug('Built query:', { sql, params: this.params });
    
    return {
      sql,
      params: this.params
    };
  }

  /**
   * Build count query
   */
  buildCount() {
    const originalSelect = this.selectFields;
    const originalLimit = this.limitValue;
    const originalOffset = this.offsetValue;
    const originalOrderBy = this.orderByFields;
    
    this.selectFields = ['COUNT(*) as total'];
    this.limitValue = null;
    this.offsetValue = null;
    this.orderByFields = [];
    
    const result = this.build();
    
    // Restore original values
    this.selectFields = originalSelect;
    this.limitValue = originalLimit;
    this.offsetValue = originalOffset;
    this.orderByFields = originalOrderBy;
    
    return result;
  }

  /**
   * Clone the query builder
   */
  clone() {
    const cloned = new QueryBuilder(this.table);
    
    cloned.selectFields = [...this.selectFields];
    cloned.whereConditions = [...this.whereConditions];
    cloned.joinClauses = [...this.joinClauses];
    cloned.orderByFields = [...this.orderByFields];
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = [...this.havingConditions];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.distinctFlag = this.distinctFlag;
    cloned.params = [...this.params];
    
    return cloned;
  }
}

/**
 * Helper function to create common queries
 */
class QueryHelpers {
  /**
   * Build player games query
   */
  static playerGames(playerName, options = {}) {
    const { 
      limit = 100, 
      offset = 0, 
      dateFrom = null, 
      dateTo = null,
      opening = null,
      result = null 
    } = options;
    
    const query = new QueryBuilder('games')
      .select('*')
      .where('white_player', '=', playerName)
      .orWhere('black_player', '=', playerName);
    
    if (dateFrom && dateTo) {
      query.whereBetween('date', dateFrom, dateTo);
    }
    
    if (opening) {
      query.where('eco', 'LIKE', `${opening}%`);
    }
    
    if (result) {
      query.where('result', '=', result);
    }
    
    return query
      .orderBy('date', 'DESC')
      .limit(limit)
      .offset(offset)
      .build();
  }

  /**
   * Build player statistics query
   */
  static playerStats(playerName) {
    const sql = `
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN white_player = ? AND result = '1-0' THEN 1 
                 WHEN black_player = ? AND result = '0-1' THEN 1 
                 ELSE 0 END) as wins,
        SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN white_player = ? AND result = '0-1' THEN 1 
                 WHEN black_player = ? AND result = '1-0' THEN 1 
                 ELSE 0 END) as losses,
        COUNT(DISTINCT CASE WHEN white_player = ? THEN black_player ELSE white_player END) as opponents,
        COUNT(DISTINCT tournament_name) as tournaments,
        MIN(date) as first_game,
        MAX(date) as last_game
      FROM games
      WHERE white_player = ? OR black_player = ?
    `;
    
    return {
      sql,
      params: [
        playerName, playerName, // wins
        playerName, playerName, // losses
        playerName, // opponents
        playerName, playerName // WHERE clause
      ]
    };
  }

  /**
   * Build opening statistics query
   */
  static openingStats(eco = null, options = {}) {
    const { limit = 20, minGames = 10 } = options;
    
    let sql = `
      SELECT 
        eco,
        opening,
        COUNT(*) as games,
        ROUND(100.0 * SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) / COUNT(*), 2) as white_win_pct,
        ROUND(100.0 * SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) / COUNT(*), 2) as black_win_pct,
        ROUND(100.0 * SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) / COUNT(*), 2) as draw_pct,
        AVG(ply_count) as avg_moves
      FROM games
      WHERE eco IS NOT NULL
    `;
    
    const params = [];
    
    if (eco) {
      sql += ' AND eco = ?';
      params.push(eco);
    }
    
    sql += `
      GROUP BY eco, opening
      HAVING COUNT(*) >= ?
      ORDER BY games DESC
      LIMIT ?
    `;
    
    params.push(minGames, limit);
    
    return { sql, params };
  }

  /**
   * Build tournament standings query
   */
  static tournamentStandings(tournamentName) {
    const sql = `
      SELECT 
        player_name,
        COUNT(*) as games,
        SUM(points) as total_points,
        SUM(wins) as wins,
        SUM(draws) as draws,
        SUM(losses) as losses,
        ROUND(100.0 * SUM(points) / COUNT(*), 2) as score_pct
      FROM (
        SELECT 
          white_player as player_name,
          CASE 
            WHEN result = '1-0' THEN 1.0
            WHEN result = '1/2-1/2' THEN 0.5
            ELSE 0
          END as points,
          CASE WHEN result = '1-0' THEN 1 ELSE 0 END as wins,
          CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
          CASE WHEN result = '0-1' THEN 1 ELSE 0 END as losses
        FROM games
        WHERE tournament_name = ?
        
        UNION ALL
        
        SELECT 
          black_player as player_name,
          CASE 
            WHEN result = '0-1' THEN 1.0
            WHEN result = '1/2-1/2' THEN 0.5
            ELSE 0
          END as points,
          CASE WHEN result = '0-1' THEN 1 ELSE 0 END as wins,
          CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
          CASE WHEN result = '1-0' THEN 1 ELSE 0 END as losses
        FROM games
        WHERE tournament_name = ?
      ) as player_results
      GROUP BY player_name
      ORDER BY total_points DESC, wins DESC
    `;
    
    return {
      sql,
      params: [tournamentName, tournamentName]
    };
  }

  /**
   * Build search query
   */
  static searchGames(criteria = {}) {
    const {
      player,
      whitePlayer,
      blackPlayer,
      opening,
      tournament,
      dateFrom,
      dateTo,
      result,
      minMoves,
      maxMoves,
      limit = 100,
      offset = 0
    } = criteria;
    
    const query = new QueryBuilder('games').select('*');
    
    if (player) {
      query.where('white_player', '=', player).orWhere('black_player', '=', player);
    }
    
    if (whitePlayer) {
      query.where('white_player', '=', whitePlayer);
    }
    
    if (blackPlayer) {
      query.where('black_player', '=', blackPlayer);
    }
    
    if (opening) {
      query.whereLike('eco', `${opening}%`);
    }
    
    if (tournament) {
      query.whereLike('tournament_name', `%${tournament}%`);
    }
    
    if (dateFrom && dateTo) {
      query.whereBetween('date', dateFrom, dateTo);
    }
    
    if (result) {
      query.where('result', '=', result);
    }
    
    if (minMoves) {
      query.where('ply_count', '>=', minMoves * 2);
    }
    
    if (maxMoves) {
      query.where('ply_count', '<=', maxMoves * 2);
    }
    
    return query
      .orderBy('date', 'DESC')
      .limit(limit)
      .offset(offset)
      .build();
  }
}

module.exports = {
  QueryBuilder,
  QueryHelpers
};