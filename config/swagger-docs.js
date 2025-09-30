/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 message:
 *                   type: string
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 */

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: API test endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is working
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 version:
 *                   type: string
 *                 features:
 *                   type: array
 *                   items:
 *                     type: string
 */

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Cache statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 short:
 *                   type: object
 *                   properties:
 *                     entries:
 *                       type: integer
 *                     hits:
 *                       type: integer
 *                     misses:
 *                       type: integer
 *                     hitRate:
 *                       type: number
 */

/**
 * @swagger
 * /api/players/search:
 *   get:
 *     summary: Search for players
 *     tags: [Players]
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         description: Search query (minimum 2 characters)
 *         schema:
 *           type: string
 *           minLength: 2
 *     responses:
 *       200:
 *         description: List of matching players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Player'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @swagger
 * /api/players/top:
 *   get:
 *     summary: Get top rated players
 *     tags: [Players]
 *     parameters:
 *       - name: category
 *         in: query
 *         description: Rating category
 *         schema:
 *           type: string
 *           enum: [bullet, blitz, rapid, classical]
 *           default: blitz
 *       - name: limit
 *         in: query
 *         description: Number of players to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - $ref: '#/components/parameters/Platform'
 *     responses:
 *       200:
 *         description: List of top players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   rank:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   title:
 *                     type: string
 *                   rating:
 *                     type: integer
 *                   platform:
 *                     type: string
 */

/**
 * @swagger
 * /api/players/{username}:
 *   get:
 *     summary: Get player profile
 *     tags: [Players]
 *     parameters:
 *       - $ref: '#/components/parameters/Username'
 *       - $ref: '#/components/parameters/Platform'
 *     responses:
 *       200:
 *         description: Player profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Player'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @swagger
 * /api/players/{username}/stats:
 *   get:
 *     summary: Get player statistics
 *     tags: [Players]
 *     parameters:
 *       - $ref: '#/components/parameters/Username'
 *       - $ref: '#/components/parameters/Platform'
 *     responses:
 *       200:
 *         description: Player statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratings:
 *                   type: object
 *                 games:
 *                   type: object
 *                 playTime:
 *                   type: object
 */

/**
 * @swagger
 * /api/players/{username}/games:
 *   get:
 *     summary: Get player games
 *     tags: [Players]
 *     parameters:
 *       - $ref: '#/components/parameters/Username'
 *       - name: year
 *         in: query
 *         description: Year to filter games
 *         schema:
 *           type: integer
 *       - name: month
 *         in: query
 *         description: Month to filter games
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: List of games
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Game'
 */

/**
 * @swagger
 * /api/tournaments:
 *   get:
 *     summary: Get all tournaments
 *     tags: [Tournaments]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - name: year
 *         in: query
 *         description: Filter by year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of tournaments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tournaments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tournament'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */

/**
 * @swagger
 * /api/tournaments/upcoming:
 *   get:
 *     summary: Get upcoming tournaments
 *     tags: [Tournaments]
 *     responses:
 *       200:
 *         description: List of upcoming tournaments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tournament'
 */

/**
 * @swagger
 * /api/tournaments/{id}:
 *   get:
 *     summary: Get tournament details
 *     tags: [Tournaments]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Tournament ID or name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tournament'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/openings/explorer:
 *   get:
 *     summary: Explore chess openings
 *     tags: [Openings]
 *     parameters:
 *       - name: fen
 *         in: query
 *         description: FEN position
 *         schema:
 *           type: string
 *       - name: play
 *         in: query
 *         description: Moves in UCI format
 *         schema:
 *           type: string
 *       - name: variant
 *         in: query
 *         description: Chess variant
 *         schema:
 *           type: string
 *           default: standard
 *       - name: speeds
 *         in: query
 *         description: Time controls
 *         schema:
 *           type: string
 *           default: blitz,rapid,classical
 *       - name: ratings
 *         in: query
 *         description: Rating ranges
 *         schema:
 *           type: string
 *           default: 1600,1800,2000,2200,2500
 *     responses:
 *       200:
 *         description: Opening explorer data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 opening:
 *                   type: object
 *                 moves:
 *                   type: array
 *                   items:
 *                     type: object
 *                 white:
 *                   type: integer
 *                 draws:
 *                   type: integer
 *                 black:
 *                   type: integer
 */

/**
 * @swagger
 * /api/openings/popular:
 *   get:
 *     summary: Get popular openings
 *     tags: [Openings]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of openings to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: List of popular openings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   eco:
 *                     type: string
 *                   name:
 *                     type: string
 *                   count:
 *                     type: integer
 *                   winRate:
 *                     type: number
 */

/**
 * @swagger
 * /api/openings/eco/{eco}:
 *   get:
 *     summary: Get opening by ECO code
 *     tags: [Openings]
 *     parameters:
 *       - name: eco
 *         in: path
 *         required: true
 *         description: ECO code (e.g., B12)
 *         schema:
 *           type: string
 *           pattern: '^[A-E][0-9]{2}$'
 *     responses:
 *       200:
 *         description: Opening details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Opening'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /api/stats/overview:
 *   get:
 *     summary: Get platform statistics overview
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Statistics overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalGames:
 *                   type: integer
 *                 totalPlayers:
 *                   type: integer
 *                 totalTournaments:
 *                   type: integer
 *                 earliestGame:
 *                   type: string
 *                 latestGame:
 *                   type: string
 */

/**
 * @swagger
 * /api/stats/rating-distribution:
 *   get:
 *     summary: Get rating distribution
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Rating distribution data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 distribution:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       range:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       percentage:
 *                         type: number
 */

/**
 * @swagger
 * /api/games/search:
 *   get:
 *     summary: Search games database
 *     tags: [Games]
 *     parameters:
 *       - name: white
 *         in: query
 *         description: White player name
 *         schema:
 *           type: string
 *       - name: black
 *         in: query
 *         description: Black player name
 *         schema:
 *           type: string
 *       - name: opening
 *         in: query
 *         description: Opening name or ECO
 *         schema:
 *           type: string
 *       - name: result
 *         in: query
 *         description: Game result
 *         schema:
 *           type: string
 *           enum: ['1-0', '0-1', '1/2-1/2']
 *       - name: limit
 *         in: query
 *         description: Number of results
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of games
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Game'
 */

module.exports = {}; // Empty export, file is just for swagger comments