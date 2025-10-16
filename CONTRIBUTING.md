# Contributing to Chess Stats

Thank you for your interest in contributing to Chess Stats! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and constructive in all interactions
- Focus on what is best for the community and the project
- Show empathy towards other community members
- Accept constructive criticism gracefully

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- Git
- Basic knowledge of TypeScript, JavaScript, React, and Next.js
- Familiarity with SQLite databases

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chess-stats.git
   cd chess-stats
   ```

2. **Install Dependencies**
   ```bash
   # Backend dependencies
   npm install

   # Frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Database Setup**
   - For development, use the smaller `railway-subset.db` in `otb-database/`
   - Full database setup instructions in `DATABASE_CHUNKS_GUIDE.md`

4. **Start Development Servers**
   ```bash
   # Option 1: Use start script (Windows)
   ./start-dev.bat

   # Option 2: Manual start
   # Backend (recommended: pooled server)
   npm run start:pooled

   # Frontend (in separate terminal)
   cd frontend && npm run dev
   ```

5. **Verify Setup**
   - Backend health: http://localhost:3010/health
   - Frontend: http://localhost:3000
   - API test page: http://localhost:3000/test

---

## Development Workflow

### Branch Strategy
- `master` - Production-ready code
- `develop` - Integration branch for features (if used)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### Making Changes
1. Write your code following our [coding standards](#coding-standards)
2. Add/update tests for your changes
3. Ensure all tests pass: `npm test`
4. Update documentation if needed
5. Run linter: `npm run lint`
6. Format code: `npm run format`

---

## Coding Standards

### TypeScript/JavaScript
- Use TypeScript for new backend code
- Use ESLint configuration in the project
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises when possible
- Document complex functions with JSDoc comments

### Example:
```typescript
/**
 * Calculate player performance score
 * @param wins - Number of wins
 * @param draws - Number of draws
 * @param total - Total games played
 * @returns Performance score as percentage
 */
function calculatePerformance(wins: number, draws: number, total: number): string {
  const score = ((wins + draws * 0.5) / total) * 100;
  return score.toFixed(1);
}
```

### React/Next.js Frontend
- Use functional components with hooks
- Prefer React Query for data fetching
- Use Tailwind CSS for styling
- Keep components small and focused
- Extract reusable logic into custom hooks

### Example:
```typescript
export function PlayerCard({ username }: { username: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['player', username],
    queryFn: () => fetchPlayer(username)
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="text-xl font-bold">{data.name}</h2>
      <p className="text-gray-600">Rating: {data.rating}</p>
    </div>
  );
}
```

### File Naming
- React components: `PascalCase.tsx`
- Utilities/helpers: `camelCase.ts` or `kebab-case.js`
- Test files: `*.test.ts` or `*.test.tsx`
- Configuration: `kebab-case.config.js`

---

## Testing Guidelines

### Test Coverage
- Aim for 70%+ code coverage
- Write tests for all new features
- Update tests when modifying existing code

### Types of Tests
1. **Unit Tests** - Individual functions/components
   ```bash
   npm test -- tests/unit/players.test.js
   ```

2. **Integration Tests** - API endpoints
   ```bash
   npm test -- tests/integration/
   ```

3. **Test Coverage Report**
   ```bash
   npm run test:coverage
   ```

### Writing Tests
```javascript
describe('Player Statistics', () => {
  it('should calculate correct performance score', () => {
    const result = calculatePerformance(10, 5, 20);
    expect(result).toBe('62.5');
  });

  it('should handle zero games', () => {
    const result = calculatePerformance(0, 0, 0);
    expect(result).toBe('0.0');
  });
});
```

---

## Commit Guidelines

### Commit Message Format
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat: Add player comparison feature

Implements side-by-side player statistics comparison
with head-to-head records and opening repertoire analysis.

Closes #123
```

```
fix: Correct ECO code parsing for extended formats

Database uses extended ECO codes (e.g., "C65j"). Updated
parser to extract base code using SUBSTR(eco, 1, 3).

Fixes #456
```

---

## Pull Request Process

### Before Submitting
1. ✅ All tests passing (`npm test`)
2. ✅ Code linted (`npm run lint`)
3. ✅ Code formatted (`npm run format`)
4. ✅ Documentation updated
5. ✅ No console.log statements (use logger)
6. ✅ TypeScript builds without errors

### PR Checklist
- [ ] Branch is up to date with master
- [ ] Descriptive title and description
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Follows coding standards
- [ ] Ready for review

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)

## Checklist
- [ ] Tests pass
- [ ] Code linted
- [ ] Documentation updated
```

---

## Project Structure

```
chess-stats/
├── src/                      # Backend TypeScript/JavaScript source
│   ├── controllers/          # API endpoint controllers
│   ├── routes/               # Express routes
│   ├── services/             # Business logic services
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── config/               # Configuration files
├── frontend/                 # Next.js frontend application
│   ├── app/                  # Next.js 15 app directory
│   │   ├── players/          # Player pages
│   │   ├── openings/         # Opening explorer
│   │   └── ...
│   └── components/           # Reusable React components
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── setup.js              # Test configuration
├── scripts/                  # Utility scripts
│   ├── database/             # Database management
│   ├── deployment/           # Deployment scripts
│   └── ...
├── otb-database/             # OTB tournament database
│   ├── railway-subset.db     # Subset database for dev
│   └── ...
├── simple-server-pooled.js   # Production server (recommended)
└── docker-compose.yml        # Docker orchestration
```

---

## Server Architecture

### Three Production Servers
1. **Port 3007** - `simple-server.js` - Legacy server
2. **Port 3009** - `simple-server-optimized.js` - Optimized with caching
3. **Port 3010** - `simple-server-pooled.js` - **RECOMMENDED** (connection pooling)

For development: Use `npm run start:pooled` (port 3010)

---

## Database Guidelines

### Working with SQLite
- Use parameterized queries to prevent SQL injection
- Always close database connections
- Use transactions for multiple operations
- Index frequently queried columns

### Example:
```javascript
const db = await getDatabase();
const stmt = db.prepare('SELECT * FROM games WHERE white_player = ?');
const games = stmt.all(playerName);
stmt.finalize();
```

### Database Schema
See `RAILWAY_DEPLOYMENT_STATUS.md` for complete schema documentation.

---

## Documentation

### Update Documentation When:
- Adding new API endpoints
- Changing configuration
- Adding npm scripts
- Modifying database schema
- Changing deployment process

### Documentation Files
- `CLAUDE.md` - Primary development guide
- `TODO.md` - Current project status and tasks
- `RAILWAY_DEPLOYMENT_STATUS.md` - Production deployment info
- `DATABASE_CHUNKS_GUIDE.md` - Database management
- API docs at `/api-docs` (Swagger)

---

## Common Tasks

### Add New API Endpoint
1. Create controller in `src/controllers/`
2. Add route in `src/routes/`
3. Update Swagger docs if applicable
4. Write tests in `tests/unit/` or `tests/integration/`
5. Update `CLAUDE.md` API section

### Add Frontend Page
1. Create page in `frontend/app/your-page/`
2. Add necessary components
3. Implement data fetching with React Query
4. Add loading and error states
5. Test responsive design

### Database Migration
1. Create migration script in `scripts/database/`
2. Test on development database
3. Document changes in comments
4. Update schema documentation

---

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Create an issue with the bug template
- **Features**: Create an issue with the feature template
- **Documentation**: Check `CLAUDE.md` and other guides

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Express.js Guide](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## License

By contributing to Chess Stats, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Chess Stats! 🎉♟️
