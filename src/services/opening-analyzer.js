/**
 * Advanced Opening Analysis System
 * Comprehensive opening analysis with ML-enhanced preparation and recommendations
 */

const chess = require('chess.js');
const { mean, standardDeviation } = require('../ml/ml-utils');

class OpeningAnalyzer {
    constructor() {
        this.openingDatabase = new Map(); // ECO -> opening info
        this.transpositionMap = new Map(); // Position hash -> openings
        this.noveltyDatabase = new Map(); // Position -> first occurrence
        this.performanceMetrics = new Map(); // Opening -> performance stats
        
        // Initialize ECO database
        this.initializeECODatabase();
        
        // Analysis configuration
        this.config = {
            maxDepth: 20,
            minGamesForAnalysis: 10,
            noveltyThreshold: 5, // Games before considering a move theory
            transpositionDepth: 10,
            recommendationFactors: {
                winRate: 0.3,
                popularity: 0.2,
                surprise: 0.2,
                complexity: 0.15,
                playerStyle: 0.15
            }
        };

        // Cache for expensive computations
        this.cache = {
            trees: new Map(),
            transpositions: new Map(),
            evaluations: new Map()
        };

        this.metrics = {
            openingsAnalyzed: 0,
            transpositionsFound: 0,
            noveltiesDetected: 0,
            recommendationsGenerated: 0
        };
    }

    /**
     * Analyze opening from PGN moves
     * @param {Array} moves - Array of moves in SAN notation
     * @param {Object} options - Analysis options
     * @returns {Object} Comprehensive opening analysis
     */
    async analyzeOpening(moves, options = {}) {
        const {
            includeTranspositions = true,
            includeNovelties = true,
            includeStatistics = true,
            includeRecommendations = true,
            maxAnalysisDepth = 15
        } = options;

        const startTime = Date.now();
        const game = new chess.Chess();
        const analysis = {
            opening: null,
            classification: null,
            transpositions: [],
            novelties: [],
            statistics: null,
            recommendations: [],
            tree: null,
            evaluation: null
        };

        try {
            // Build position history
            const positionHistory = [];
            let moveNumber = 0;

            for (const move of moves.slice(0, maxAnalysisDepth)) {
                const moveObj = game.move(move);
                if (!moveObj) break;
                
                moveNumber++;
                const position = {
                    fen: game.fen(),
                    move: moveObj.san,
                    moveNumber,
                    positionHash: this.hashPosition(game.fen())
                };
                positionHistory.push(position);
            }

            // Classify opening
            analysis.classification = this.classifyOpening(positionHistory);
            analysis.opening = analysis.classification.name;

            // Find transpositions
            if (includeTranspositions) {
                analysis.transpositions = await this.findTranspositions(positionHistory);
            }

            // Detect novelties
            if (includeNovelties) {
                analysis.novelties = await this.detectNovelties(positionHistory);
            }

            // Calculate statistics
            if (includeStatistics) {
                analysis.statistics = await this.calculateOpeningStatistics(
                    analysis.classification.eco,
                    positionHistory
                );
            }

            // Generate recommendations
            if (includeRecommendations) {
                analysis.recommendations = await this.generateRecommendations(
                    positionHistory,
                    analysis.classification
                );
            }

            // Build opening tree
            analysis.tree = await this.buildOpeningTree(positionHistory, {
                maxDepth: 5,
                includeStatistics: true
            });

            // Evaluate opening position
            analysis.evaluation = this.evaluateOpeningPosition(game);

            this.metrics.openingsAnalyzed++;

            return {
                success: true,
                analysis,
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            console.error('Opening analysis error:', error);
            return {
                success: false,
                error: error.message,
                analysis
            };
        }
    }

    /**
     * Build comprehensive opening tree
     * @param {Array} positionHistory - Position history
     * @param {Object} options - Tree building options
     * @returns {Object} Opening tree structure
     */
    async buildOpeningTree(positionHistory, options = {}) {
        const { maxDepth = 10, includeStatistics = true, minFrequency = 0.01 } = options;
        
        const tree = {
            root: {
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                children: []
            },
            totalGames: 0,
            depth: 0,
            variations: []
        };

        // Build tree from database (would connect to actual game database)
        const variations = await this.getOpeningVariations(positionHistory);
        
        for (const variation of variations) {
            if (variation.frequency >= minFrequency) {
                const node = this.buildTreeNode(variation, includeStatistics);
                tree.root.children.push(node);
                tree.totalGames += variation.games;
            }
        }

        tree.depth = this.calculateTreeDepth(tree.root);
        tree.variations = this.extractMainVariations(tree.root, maxDepth);

        return tree;
    }

    /**
     * Find transpositions in position history
     * @param {Array} positionHistory - Position history
     * @returns {Array} Found transpositions
     */
    async findTranspositions(positionHistory) {
        const transpositions = [];
        
        for (const position of positionHistory) {
            const hash = position.positionHash;
            
            // Check if this position can be reached via different move orders
            const alternativePaths = await this.findAlternativePaths(position.fen);
            
            if (alternativePaths.length > 1) {
                transpositions.push({
                    position: position.fen,
                    moveNumber: position.moveNumber,
                    paths: alternativePaths,
                    commonOpenings: this.getCommonOpenings(alternativePaths)
                });
                
                this.metrics.transpositionsFound++;
            }
        }

        return transpositions;
    }

    /**
     * Detect novelties in position history
     * @param {Array} positionHistory - Position history
     * @returns {Array} Detected novelties
     */
    async detectNovelties(positionHistory) {
        const novelties = [];
        
        for (let i = 0; i < positionHistory.length; i++) {
            const position = positionHistory[i];
            const gameCount = await this.getPositionGameCount(position.fen);
            
            if (gameCount < this.config.noveltyThreshold) {
                // Check if previous position was known
                if (i > 0) {
                    const prevGameCount = await this.getPositionGameCount(
                        positionHistory[i - 1].fen
                    );
                    
                    if (prevGameCount >= this.config.noveltyThreshold) {
                        novelties.push({
                            move: position.move,
                            moveNumber: position.moveNumber,
                            position: position.fen,
                            previousGames: prevGameCount,
                            currentGames: gameCount,
                            isTheoretical: gameCount > 0,
                            evaluation: this.evaluateNovelty(position)
                        });
                        
                        this.metrics.noveltiesDetected++;
                    }
                }
            }
        }

        return novelties;
    }

    /**
     * Generate opening recommendations
     * @param {Array} positionHistory - Current position history
     * @param {Object} classification - Opening classification
     * @param {Object} playerProfile - Optional player profile
     * @returns {Array} Recommended continuations
     */
    async generateRecommendations(positionHistory, classification, playerProfile = null) {
        const recommendations = [];
        const currentPosition = positionHistory[positionHistory.length - 1];
        
        // Get possible continuations
        const continuations = await this.getPossibleContinuations(currentPosition.fen);
        
        for (const continuation of continuations) {
            const score = this.calculateRecommendationScore(continuation, playerProfile);
            
            if (score > 0.5) { // Threshold for recommendation
                recommendations.push({
                    move: continuation.move,
                    score,
                    reasoning: this.generateRecommendationReasoning(continuation, score),
                    statistics: continuation.statistics,
                    difficulty: continuation.difficulty,
                    surprise: continuation.surpriseValue
                });
            }
        }

        // Sort by score
        recommendations.sort((a, b) => b.score - a.score);
        
        this.metrics.recommendationsGenerated += recommendations.length;
        
        return recommendations.slice(0, 5); // Top 5 recommendations
    }

    /**
     * Analyze player's opening repertoire
     * @param {Array} games - Player's games
     * @param {Object} options - Analysis options
     * @returns {Object} Repertoire analysis
     */
    async analyzeRepertoire(games, options = {}) {
        const { color = 'both', minGames = 3 } = options;
        
        const repertoire = {
            white: new Map(),
            black: new Map(),
            statistics: {
                diversity: 0,
                consistency: 0,
                effectiveness: 0
            },
            recommendations: [],
            weaknesses: [],
            strengths: []
        };

        // Analyze each game's opening
        for (const game of games) {
            const isWhite = game.white === options.playerName;
            const colorKey = isWhite ? 'white' : 'black';
            
            if (color === 'both' || color === colorKey) {
                const opening = await this.analyzeOpening(game.moves, {
                    includeStatistics: true,
                    includeTranspositions: false
                });
                
                if (opening.success) {
                    const eco = opening.analysis.classification.eco;
                    if (!repertoire[colorKey].has(eco)) {
                        repertoire[colorKey].set(eco, {
                            name: opening.analysis.opening,
                            games: [],
                            statistics: {
                                played: 0,
                                won: 0,
                                drawn: 0,
                                lost: 0,
                                performance: 0
                            }
                        });
                    }
                    
                    const entry = repertoire[colorKey].get(eco);
                    entry.games.push(game);
                    entry.statistics.played++;
                    
                    // Update result statistics
                    if (game.result === '1-0' && isWhite || game.result === '0-1' && !isWhite) {
                        entry.statistics.won++;
                    } else if (game.result === '1/2-1/2') {
                        entry.statistics.drawn++;
                    } else {
                        entry.statistics.lost++;
                    }
                }
            }
        }

        // Calculate repertoire metrics
        repertoire.statistics = this.calculateRepertoireStatistics(repertoire);
        
        // Identify strengths and weaknesses
        repertoire.strengths = this.identifyRepertoireStrengths(repertoire);
        repertoire.weaknesses = this.identifyRepertoireWeaknesses(repertoire);
        
        // Generate improvement recommendations
        repertoire.recommendations = await this.generateRepertoireRecommendations(
            repertoire,
            options
        );

        return repertoire;
    }

    /**
     * Prepare against specific opponent
     * @param {string} opponentName - Opponent's name
     * @param {Object} options - Preparation options
     * @returns {Object} Preparation package
     */
    async prepareAgainstOpponent(opponentName, options = {}) {
        const {
            color = 'both',
            recentGamesCount = 50,
            focusOnWeaknesses = true,
            includeSurprises = true
        } = options;

        const preparation = {
            opponent: opponentName,
            repertoireAnalysis: null,
            recommendations: [],
            targetedLines: [],
            surpriseWeapons: [],
            avoidLines: [],
            statistics: null
        };

        // Get opponent's recent games
        const opponentGames = await this.getPlayerGames(opponentName, recentGamesCount);
        
        // Analyze opponent's repertoire
        preparation.repertoireAnalysis = await this.analyzeRepertoire(opponentGames, {
            playerName: opponentName
        });

        // Identify weak spots
        if (focusOnWeaknesses) {
            preparation.targetedLines = this.identifyTargetableLines(
                preparation.repertoireAnalysis
            );
        }

        // Find surprise weapons
        if (includeSurprises) {
            preparation.surpriseWeapons = await this.findSurpriseWeapons(
                preparation.repertoireAnalysis,
                color
            );
        }

        // Identify lines to avoid
        preparation.avoidLines = this.identifyDangerousLines(
            preparation.repertoireAnalysis
        );

        // Generate specific preparation recommendations
        preparation.recommendations = await this.generatePreparationRecommendations(
            preparation.repertoireAnalysis,
            options
        );

        // Calculate preparation statistics
        preparation.statistics = {
            gamesAnalyzed: opponentGames.length,
            uniqueOpenings: this.countUniqueOpenings(preparation.repertoireAnalysis),
            predictability: this.calculatePredictability(preparation.repertoireAnalysis),
            preparationScore: this.calculatePreparationScore(preparation)
        };

        return preparation;
    }

    /**
     * Analyze opening trends
     * @param {Object} options - Trend analysis options
     * @returns {Object} Trend analysis results
     */
    async analyzeOpeningTrends(options = {}) {
        const {
            timeframe = '6months',
            ratingRange = null,
            topCount = 10
        } = options;

        const trends = {
            rising: [],
            declining: [],
            stable: [],
            seasonal: [],
            byRating: {},
            innovations: []
        };

        // Get games from timeframe
        const games = await this.getGamesFromTimeframe(timeframe, ratingRange);
        
        // Calculate opening frequencies over time
        const openingFrequencies = this.calculateOpeningFrequencies(games);
        
        // Identify trends
        for (const [eco, data] of openingFrequencies) {
            const trend = this.calculateTrend(data.timeline);
            
            const trendData = {
                eco,
                name: data.name,
                currentFrequency: data.currentFrequency,
                change: trend.change,
                trendScore: trend.score,
                momentum: trend.momentum,
                games: data.totalGames
            };

            if (trend.direction === 'rising') {
                trends.rising.push(trendData);
            } else if (trend.direction === 'declining') {
                trends.declining.push(trendData);
            } else {
                trends.stable.push(trendData);
            }

            // Check for seasonal patterns
            if (this.hasSeasonalPattern(data.timeline)) {
                trends.seasonal.push(trendData);
            }
        }

        // Sort by trend strength
        trends.rising.sort((a, b) => b.trendScore - a.trendScore);
        trends.declining.sort((a, b) => a.trendScore - b.trendScore);

        // Analyze by rating if specified
        if (ratingRange) {
            trends.byRating = await this.analyzeOpeningsByRating(games, ratingRange);
        }

        // Find recent innovations
        trends.innovations = await this.findRecentInnovations(games);

        return {
            trends: trends.rising.slice(0, topCount),
            declining: trends.declining.slice(0, topCount),
            stable: trends.stable.slice(0, topCount),
            seasonal: trends.seasonal,
            byRating: trends.byRating,
            innovations: trends.innovations,
            metadata: {
                timeframe,
                gamesAnalyzed: games.length,
                uniqueOpenings: openingFrequencies.size,
                analysisDate: new Date().toISOString()
            }
        };
    }

    /**
     * Calculate opening performance metrics
     * @param {string} eco - ECO code
     * @param {Array} games - Games to analyze
     * @returns {Object} Performance metrics
     */
    async calculateOpeningPerformanceMetrics(eco, games) {
        const metrics = {
            eco,
            name: this.getOpeningName(eco),
            games: games.length,
            winRate: { white: 0, black: 0, total: 0 },
            drawRate: 0,
            averageGameLength: 0,
            complexity: 0,
            sharpness: 0,
            popularity: {
                overall: 0,
                byRating: {}
            },
            performance: {
                byRating: {},
                byTimeControl: {},
                trend: null
            }
        };

        // Calculate basic statistics
        let whiteWins = 0, blackWins = 0, draws = 0;
        let totalMoves = 0;

        for (const game of games) {
            if (game.result === '1-0') whiteWins++;
            else if (game.result === '0-1') blackWins++;
            else if (game.result === '1/2-1/2') draws++;
            
            totalMoves += game.moves.length;
        }

        metrics.winRate.white = whiteWins / games.length;
        metrics.winRate.black = blackWins / games.length;
        metrics.winRate.total = (whiteWins + blackWins * 0.5) / games.length;
        metrics.drawRate = draws / games.length;
        metrics.averageGameLength = totalMoves / games.length;

        // Calculate complexity (based on average branches and game length variance)
        metrics.complexity = await this.calculateOpeningComplexity(eco, games);

        // Calculate sharpness (based on decisive game rate and material imbalances)
        metrics.sharpness = this.calculateOpeningSharpness(games);

        // Calculate popularity metrics
        metrics.popularity = await this.calculatePopularityMetrics(eco, games);

        // Calculate performance by categories
        metrics.performance.byRating = this.calculatePerformanceByRating(games);
        metrics.performance.byTimeControl = this.calculatePerformanceByTimeControl(games);
        metrics.performance.trend = await this.calculatePerformanceTrend(eco);

        // Store in cache
        this.performanceMetrics.set(eco, metrics);

        return metrics;
    }

    // Helper methods

    classifyOpening(positionHistory) {
        // Simplified ECO classification
        // In production, use comprehensive ECO database
        const moveSequence = positionHistory.map(p => p.move).join(' ');
        
        // Common opening patterns
        if (moveSequence.startsWith('e4 e5')) {
            if (moveSequence.includes('Nf3 Nc6')) {
                if (moveSequence.includes('Bb5')) {
                    return { eco: 'C60', name: 'Ruy Lopez', category: 'Open Game' };
                }
                if (moveSequence.includes('Bc4')) {
                    return { eco: 'C50', name: 'Italian Game', category: 'Open Game' };
                }
                return { eco: 'C40', name: 'Kings Knight Opening', category: 'Open Game' };
            }
            return { eco: 'C20', name: 'Kings Pawn Game', category: 'Open Game' };
        }
        
        if (moveSequence.startsWith('d4')) {
            if (moveSequence.includes('d5')) {
                if (moveSequence.includes('c4')) {
                    return { eco: 'D00', name: 'Queens Gambit', category: 'Closed Game' };
                }
                return { eco: 'D00', name: 'Queens Pawn Game', category: 'Closed Game' };
            }
            if (moveSequence.includes('Nf6')) {
                return { eco: 'A45', name: 'Indian Defense', category: 'Indian Defense' };
            }
        }

        if (moveSequence.startsWith('e4 c5')) {
            return { eco: 'B20', name: 'Sicilian Defense', category: 'Semi-Open Game' };
        }

        if (moveSequence.startsWith('e4 e6')) {
            return { eco: 'C00', name: 'French Defense', category: 'Semi-Open Game' };
        }

        if (moveSequence.startsWith('e4 c6')) {
            return { eco: 'B10', name: 'Caro-Kann Defense', category: 'Semi-Open Game' };
        }

        if (moveSequence.startsWith('Nf3')) {
            return { eco: 'A04', name: 'Reti Opening', category: 'Flank Opening' };
        }

        if (moveSequence.startsWith('c4')) {
            return { eco: 'A10', name: 'English Opening', category: 'Flank Opening' };
        }

        return { eco: 'A00', name: 'Uncommon Opening', category: 'Irregular' };
    }

    hashPosition(fen) {
        // Simple hash function for position
        // In production, use Zobrist hashing
        let hash = 0;
        for (let i = 0; i < fen.length; i++) {
            const char = fen.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    async findAlternativePaths(fen) {
        // Find different move orders leading to same position
        // This would query a database of games
        const paths = [];
        
        // Simplified - return mock data
        const positionHash = this.hashPosition(fen);
        if (this.transpositionMap.has(positionHash)) {
            return this.transpositionMap.get(positionHash);
        }

        // In production, query database for all games reaching this position
        return paths;
    }

    getCommonOpenings(paths) {
        // Extract common opening names from paths
        const openings = new Set();
        for (const path of paths) {
            const classification = this.classifyOpening(path);
            openings.add(classification.name);
        }
        return Array.from(openings);
    }

    async getPositionGameCount(fen) {
        // Get number of games reaching this position
        // In production, query game database
        return Math.floor(Math.random() * 1000); // Mock data
    }

    evaluateNovelty(position) {
        // Evaluate quality of novelty
        const game = new chess.Chess();
        game.load(position.fen);
        
        return {
            soundness: this.evaluateSoundness(game),
            surprise: Math.random(), // Mock surprise value
            complexity: this.evaluateComplexity(game),
            practical: Math.random() > 0.5
        };
    }

    evaluateSoundness(game) {
        // Simple soundness evaluation
        // In production, use chess engine
        return {
            score: 0,
            assessment: 'playable'
        };
    }

    evaluateComplexity(game) {
        // Evaluate position complexity
        const moves = game.moves();
        return {
            legalMoves: moves.length,
            complexity: moves.length > 30 ? 'high' : moves.length > 20 ? 'medium' : 'low'
        };
    }

    async getPossibleContinuations(fen) {
        // Get possible moves from position with statistics
        const game = new chess.Chess();
        game.load(fen);
        
        const moves = game.moves();
        const continuations = [];
        
        for (const move of moves.slice(0, 10)) { // Top 10 moves
            continuations.push({
                move,
                statistics: {
                    games: Math.floor(Math.random() * 1000),
                    winRate: Math.random(),
                    popularity: Math.random()
                },
                difficulty: Math.random(),
                surpriseValue: Math.random()
            });
        }
        
        return continuations;
    }

    calculateRecommendationScore(continuation, playerProfile) {
        const factors = this.config.recommendationFactors;
        let score = 0;
        
        // Win rate factor
        score += continuation.statistics.winRate * factors.winRate;
        
        // Popularity factor (inverse for surprise)
        score += (1 - continuation.statistics.popularity) * factors.surprise;
        
        // Complexity factor (based on player preference)
        const complexityPreference = playerProfile?.preferComplexPositions ? 1 : 0;
        score += (continuation.difficulty * complexityPreference) * factors.complexity;
        
        // Style match factor
        if (playerProfile) {
            const styleMatch = this.calculateStyleMatch(continuation, playerProfile);
            score += styleMatch * factors.playerStyle;
        }
        
        return score;
    }

    calculateStyleMatch(continuation, playerProfile) {
        // Calculate how well move matches player style
        // Simplified implementation
        return Math.random();
    }

    generateRecommendationReasoning(continuation, score) {
        const reasons = [];
        
        if (continuation.statistics.winRate > 0.55) {
            reasons.push(`High win rate: ${(continuation.statistics.winRate * 100).toFixed(1)}%`);
        }
        
        if (continuation.surpriseValue > 0.7) {
            reasons.push('Surprise value - rarely played');
        }
        
        if (continuation.difficulty > 0.6) {
            reasons.push('Creates complex positions');
        }
        
        return reasons.join('; ');
    }

    async getOpeningVariations(positionHistory) {
        // Get variations from database
        // Mock implementation
        return [
            {
                moves: ['e4', 'e5', 'Nf3'],
                frequency: 0.3,
                games: 10000,
                winRate: 0.54
            },
            {
                moves: ['d4', 'd5', 'c4'],
                frequency: 0.25,
                games: 8000,
                winRate: 0.52
            }
        ];
    }

    buildTreeNode(variation, includeStatistics) {
        return {
            move: variation.moves[variation.moves.length - 1],
            frequency: variation.frequency,
            games: variation.games,
            statistics: includeStatistics ? {
                winRate: variation.winRate,
                drawRate: variation.drawRate || 0.3,
                popularity: variation.frequency
            } : null,
            children: []
        };
    }

    calculateTreeDepth(node, currentDepth = 0) {
        if (!node.children || node.children.length === 0) {
            return currentDepth;
        }
        
        let maxDepth = currentDepth;
        for (const child of node.children) {
            const childDepth = this.calculateTreeDepth(child, currentDepth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
        }
        
        return maxDepth;
    }

    extractMainVariations(node, maxDepth, currentPath = []) {
        const variations = [];
        
        if (currentPath.length >= maxDepth || !node.children || node.children.length === 0) {
            if (currentPath.length > 0) {
                variations.push([...currentPath]);
            }
            return variations;
        }
        
        for (const child of node.children) {
            const childVariations = this.extractMainVariations(
                child,
                maxDepth,
                [...currentPath, child.move]
            );
            variations.push(...childVariations);
        }
        
        return variations;
    }

    evaluateOpeningPosition(game) {
        // Evaluate current opening position
        return {
            development: this.evaluateDevelopment(game),
            centerControl: this.evaluateCenterControl(game),
            kingSafety: this.evaluateKingSafety(game),
            pawnStructure: this.evaluatePawnStructure(game),
            assessment: 'balanced' // Simplified
        };
    }

    evaluateDevelopment(game) {
        // Count developed pieces
        const board = game.board();
        let whiteDevelopment = 0;
        let blackDevelopment = 0;
        
        // Simplified development counting
        return {
            white: whiteDevelopment,
            black: blackDevelopment,
            advantage: whiteDevelopment - blackDevelopment
        };
    }

    evaluateCenterControl(game) {
        // Evaluate center control
        const centerSquares = ['e4', 'e5', 'd4', 'd5'];
        let whiteControl = 0;
        let blackControl = 0;
        
        // Simplified center evaluation
        return {
            white: whiteControl,
            black: blackControl,
            assessment: 'equal'
        };
    }

    evaluateKingSafety(game) {
        // Evaluate king safety
        return {
            white: 'safe',
            black: 'safe',
            assessment: 'both kings safe'
        };
    }

    evaluatePawnStructure(game) {
        // Evaluate pawn structure
        return {
            weaknesses: [],
            strengths: [],
            assessment: 'solid'
        };
    }

    calculateRepertoireStatistics(repertoire) {
        const stats = {
            diversity: 0,
            consistency: 0,
            effectiveness: 0
        };

        // Calculate diversity (number of different openings)
        const whiteOpenings = repertoire.white.size;
        const blackOpenings = repertoire.black.size;
        stats.diversity = (whiteOpenings + blackOpenings) / 2;

        // Calculate consistency (how often main openings are played)
        const whiteGames = Array.from(repertoire.white.values())
            .reduce((sum, o) => sum + o.statistics.played, 0);
        const blackGames = Array.from(repertoire.black.values())
            .reduce((sum, o) => sum + o.statistics.played, 0);
        
        if (whiteGames > 0 && repertoire.white.size > 0) {
            const avgGamesPerOpening = whiteGames / repertoire.white.size;
            stats.consistency = avgGamesPerOpening / whiteGames;
        }

        // Calculate effectiveness (average performance)
        let totalPerformance = 0;
        let count = 0;
        
        for (const opening of repertoire.white.values()) {
            const perf = (opening.statistics.won + opening.statistics.drawn * 0.5) / 
                        opening.statistics.played;
            totalPerformance += perf;
            count++;
        }
        
        for (const opening of repertoire.black.values()) {
            const perf = (opening.statistics.won + opening.statistics.drawn * 0.5) / 
                        opening.statistics.played;
            totalPerformance += perf;
            count++;
        }
        
        stats.effectiveness = count > 0 ? totalPerformance / count : 0;

        return stats;
    }

    identifyRepertoireStrengths(repertoire) {
        const strengths = [];
        
        // Find high-performing openings
        for (const [eco, data] of repertoire.white) {
            const winRate = data.statistics.won / data.statistics.played;
            if (winRate > 0.6 && data.statistics.played >= 5) {
                strengths.push({
                    opening: data.name,
                    eco,
                    color: 'white',
                    winRate,
                    games: data.statistics.played
                });
            }
        }
        
        for (const [eco, data] of repertoire.black) {
            const winRate = data.statistics.won / data.statistics.played;
            if (winRate > 0.6 && data.statistics.played >= 5) {
                strengths.push({
                    opening: data.name,
                    eco,
                    color: 'black',
                    winRate,
                    games: data.statistics.played
                });
            }
        }
        
        return strengths;
    }

    identifyRepertoireWeaknesses(repertoire) {
        const weaknesses = [];
        
        // Find poor-performing openings
        for (const [eco, data] of repertoire.white) {
            const winRate = data.statistics.won / data.statistics.played;
            if (winRate < 0.4 && data.statistics.played >= 5) {
                weaknesses.push({
                    opening: data.name,
                    eco,
                    color: 'white',
                    winRate,
                    games: data.statistics.played,
                    recommendation: 'Consider alternative or more preparation'
                });
            }
        }
        
        for (const [eco, data] of repertoire.black) {
            const winRate = data.statistics.won / data.statistics.played;
            if (winRate < 0.4 && data.statistics.played >= 5) {
                weaknesses.push({
                    opening: data.name,
                    eco,
                    color: 'black',
                    winRate,
                    games: data.statistics.played,
                    recommendation: 'Consider alternative or more preparation'
                });
            }
        }
        
        return weaknesses;
    }

    async generateRepertoireRecommendations(repertoire, options) {
        const recommendations = [];
        
        // Recommend based on weaknesses
        if (repertoire.weaknesses.length > 0) {
            recommendations.push({
                type: 'improvement',
                priority: 'high',
                message: `Focus on improving weak openings: ${repertoire.weaknesses.map(w => w.opening).join(', ')}`,
                specific: repertoire.weaknesses
            });
        }
        
        // Recommend diversity if too narrow
        if (repertoire.statistics.diversity < 3) {
            recommendations.push({
                type: 'diversity',
                priority: 'medium',
                message: 'Consider expanding repertoire for unpredictability',
                suggestions: await this.suggestNewOpenings(repertoire)
            });
        }
        
        // Recommend consistency if too scattered
        if (repertoire.statistics.consistency < 0.3) {
            recommendations.push({
                type: 'consistency',
                priority: 'medium',
                message: 'Focus on mastering fewer openings for better results',
                mainOpenings: this.identifyMainOpenings(repertoire)
            });
        }
        
        return recommendations;
    }

    async suggestNewOpenings(repertoire) {
        // Suggest openings not in current repertoire
        const suggestions = [];
        
        // Mock suggestions - in production, use database
        suggestions.push({
            eco: 'B90',
            name: 'Sicilian Najdorf',
            reason: 'Sharp, tactical play',
            difficulty: 'high',
            expectedImprovement: '+5% win rate'
        });
        
        return suggestions;
    }

    identifyMainOpenings(repertoire) {
        // Identify most played openings to focus on
        const main = [];
        
        const allOpenings = [
            ...Array.from(repertoire.white.entries()).map(([eco, data]) => ({
                ...data,
                eco,
                color: 'white'
            })),
            ...Array.from(repertoire.black.entries()).map(([eco, data]) => ({
                ...data,
                eco,
                color: 'black'
            }))
        ];
        
        allOpenings.sort((a, b) => b.statistics.played - a.statistics.played);
        
        return allOpenings.slice(0, 3).map(o => ({
            name: o.name,
            eco: o.eco,
            color: o.color,
            games: o.statistics.played
        }));
    }

    // Additional helper methods for trend analysis, opponent preparation, etc.

    async getPlayerGames(playerName, limit) {
        // Fetch player games from database
        // Mock implementation
        return [];
    }

    identifyTargetableLines(repertoireAnalysis) {
        // Find opponent's weak lines to target
        const targetable = [];
        
        for (const [eco, data] of repertoireAnalysis.white) {
            if (data.statistics.lost / data.statistics.played > 0.4) {
                targetable.push({
                    opening: data.name,
                    eco,
                    color: 'white',
                    weakness: 'high loss rate',
                    exploitMethod: 'aggressive play'
                });
            }
        }
        
        return targetable;
    }

    async findSurpriseWeapons(repertoireAnalysis, color) {
        // Find uncommon but sound lines
        const surprises = [];
        
        // Mock implementation
        surprises.push({
            opening: 'Kings Indian Attack',
            eco: 'A05',
            surpriseValue: 0.8,
            soundness: 0.7,
            preparation: 'Study model games'
        });
        
        return surprises;
    }

    identifyDangerousLines(repertoireAnalysis) {
        // Identify opponent's strongest lines to avoid
        const dangerous = [];
        
        for (const [eco, data] of repertoireAnalysis.white) {
            if (data.statistics.won / data.statistics.played > 0.7) {
                dangerous.push({
                    opening: data.name,
                    eco,
                    color: 'white',
                    danger: 'high win rate',
                    avoidanceStrategy: 'transpose to different system'
                });
            }
        }
        
        return dangerous;
    }

    async generatePreparationRecommendations(repertoireAnalysis, options) {
        const recommendations = [];
        
        // Based on opponent's repertoire
        recommendations.push({
            priority: 'high',
            focus: 'Target weak openings',
            specific: repertoireAnalysis.weaknesses
        });
        
        recommendations.push({
            priority: 'medium',
            focus: 'Prepare surprises',
            specific: await this.findSurpriseWeapons(repertoireAnalysis, options.color)
        });
        
        return recommendations;
    }

    countUniqueOpenings(repertoireAnalysis) {
        return repertoireAnalysis.white.size + repertoireAnalysis.black.size;
    }

    calculatePredictability(repertoireAnalysis) {
        // Calculate how predictable opponent's choices are
        const totalGames = Array.from(repertoireAnalysis.white.values())
            .reduce((sum, o) => sum + o.statistics.played, 0) +
            Array.from(repertoireAnalysis.black.values())
            .reduce((sum, o) => sum + o.statistics.played, 0);
        
        const uniqueOpenings = this.countUniqueOpenings(repertoireAnalysis);
        
        return uniqueOpenings > 0 ? 1 - (uniqueOpenings / totalGames) : 1;
    }

    calculatePreparationScore(preparation) {
        // Score quality of preparation
        let score = 0;
        
        if (preparation.targetedLines.length > 0) score += 0.3;
        if (preparation.surpriseWeapons.length > 0) score += 0.3;
        if (preparation.avoidLines.length > 0) score += 0.2;
        if (preparation.recommendations.length > 0) score += 0.2;
        
        return score;
    }

    // Trend analysis methods

    async getGamesFromTimeframe(timeframe, ratingRange) {
        // Fetch games from specified timeframe
        // Mock implementation
        return [];
    }

    calculateOpeningFrequencies(games) {
        const frequencies = new Map();
        
        // Count opening occurrences
        for (const game of games) {
            const opening = this.classifyOpening(game.moves);
            if (!frequencies.has(opening.eco)) {
                frequencies.set(opening.eco, {
                    name: opening.name,
                    timeline: [],
                    totalGames: 0,
                    currentFrequency: 0
                });
            }
            
            const data = frequencies.get(opening.eco);
            data.totalGames++;
            // Add to timeline...
        }
        
        return frequencies;
    }

    calculateTrend(timeline) {
        // Calculate trend from timeline data
        if (timeline.length < 2) {
            return { direction: 'stable', change: 0, score: 0, momentum: 0 };
        }
        
        // Simplified trend calculation
        const recent = timeline.slice(-5);
        const older = timeline.slice(0, 5);
        const recentAvg = mean(recent);
        const olderAvg = mean(older);
        const change = recentAvg - olderAvg;
        
        let direction = 'stable';
        if (change > 0.05) direction = 'rising';
        else if (change < -0.05) direction = 'declining';
        
        return {
            direction,
            change,
            score: Math.abs(change),
            momentum: change / Math.max(olderAvg, 0.01)
        };
    }

    hasSeasonalPattern(timeline) {
        // Check for seasonal patterns
        // Simplified - would use actual seasonal analysis
        return timeline.length > 12 && Math.random() > 0.8;
    }

    async analyzeOpeningsByRating(games, ratingRange) {
        // Analyze opening preferences by rating
        const byRating = {};
        
        // Group games by rating brackets
        const brackets = [
            { min: 0, max: 1200, label: 'Beginner' },
            { min: 1200, max: 1600, label: 'Intermediate' },
            { min: 1600, max: 2000, label: 'Advanced' },
            { min: 2000, max: 2400, label: 'Expert' },
            { min: 2400, max: 3000, label: 'Master' }
        ];
        
        for (const bracket of brackets) {
            const bracketGames = games.filter(g => 
                g.whiteRating >= bracket.min && g.whiteRating < bracket.max
            );
            
            if (bracketGames.length > 0) {
                byRating[bracket.label] = this.calculateOpeningFrequencies(bracketGames);
            }
        }
        
        return byRating;
    }

    async findRecentInnovations(games) {
        // Find recent theoretical novelties
        const innovations = [];
        
        // Mock implementation
        innovations.push({
            move: 'h3',
            position: 'position_fen',
            game: 'Player1 vs Player2',
            date: new Date().toISOString(),
            impact: 'high',
            adoption: 0.05
        });
        
        return innovations;
    }

    async calculateOpeningComplexity(eco, games) {
        // Calculate complexity based on branching and outcomes
        return Math.random(); // Simplified
    }

    calculateOpeningSharpness(games) {
        // Calculate sharpness based on decisive games
        let decisive = 0;
        for (const game of games) {
            if (game.result !== '1/2-1/2') decisive++;
        }
        return decisive / games.length;
    }

    async calculatePopularityMetrics(eco, games) {
        // Calculate popularity metrics
        return {
            overall: games.length / 10000, // Simplified
            byRating: {},
            trend: 'stable'
        };
    }

    calculatePerformanceByRating(games) {
        // Calculate performance in different rating ranges
        return {};
    }

    calculatePerformanceByTimeControl(games) {
        // Calculate performance in different time controls
        return {};
    }

    async calculatePerformanceTrend(eco) {
        // Calculate performance trend over time
        return 'improving';
    }

    getOpeningName(eco) {
        // Get opening name from ECO code
        const ecoDatabase = {
            'C60': 'Ruy Lopez',
            'C50': 'Italian Game',
            'B20': 'Sicilian Defense',
            'C00': 'French Defense',
            'B10': 'Caro-Kann Defense',
            'D00': 'Queens Gambit',
            'A45': 'Indian Defense'
        };
        
        return ecoDatabase[eco] || 'Unknown Opening';
    }

    initializeECODatabase() {
        // Initialize comprehensive ECO database
        // In production, load from file or database
        this.ecoDatabase = new Map([
            ['A00', { name: 'Uncommon Opening', category: 'Irregular' }],
            ['A04', { name: 'Reti Opening', category: 'Flank' }],
            ['A10', { name: 'English Opening', category: 'Flank' }],
            ['B20', { name: 'Sicilian Defense', category: 'Semi-Open' }],
            ['C00', { name: 'French Defense', category: 'Semi-Open' }],
            ['C60', { name: 'Ruy Lopez', category: 'Open' }],
            ['D00', { name: 'Queens Pawn Game', category: 'Closed' }]
        ]);
    }
}

module.exports = OpeningAnalyzer;