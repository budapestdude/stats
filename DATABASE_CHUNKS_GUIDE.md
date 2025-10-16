# Database Chunks Handling Guide

## Overview
The complete-tournaments.db database (5.1GB, 9.1M games) is split into 3 chunks for GitHub Release distribution, as Git/GitHub has file size limits.

## File Information
- `complete-tournaments.db.part1` - 1.9GB
- `complete-tournaments.db.part2` - 1.9GB
- `complete-tournaments.db.part3` - 1.4GB
- **Total**: 5.1GB when reassembled

## Current Storage Strategy

### GitHub Release
- **Location**: https://github.com/budapestdude/stats/releases/tag/database-v2
- **Method**: Uploaded as release assets
- **Accessibility**: Public download via HTTP
- **Reliability**: ✅ High - GitHub CDN distribution

### Local Development
- **Not tracked in git**: These files are too large for git repositories
- **Listed in .gitignore**: `*.db` files are ignored (except railway-subset.db)
- **Download manually**: Use the download script or get from GitHub Release

## Reassembly Process

### On Railway (Production)
```javascript
// download-full-db.js handles this automatically
const chunks = [
  'https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part1',
  'https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part2',
  'https://github.com/budapestdude/stats/releases/download/database-v2/complete-tournaments.db.part3'
];

// Download all chunks
// Concatenate in order
// Copy to /tmp for SQLite write access
```

### Local Development
```bash
# Option 1: Use the download script
node download-full-db.js

# Option 2: Manual reassembly (Windows)
copy /b complete-tournaments.db.part1 + complete-tournaments.db.part2 + complete-tournaments.db.part3 complete-tournaments.db

# Option 3: Manual reassembly (Linux/Mac)
cat complete-tournaments.db.part1 complete-tournaments.db.part2 complete-tournaments.db.part3 > complete-tournaments.db
```

## Git Tracking Recommendations

### ✅ DO Track in Git
- `otb-database/railway-subset.db` - Small subset database for testing (already tracked)
- Database download scripts
- Database documentation

### ❌ DO NOT Track in Git
- `complete-tournaments.db` - Full database (5.1GB)
- `complete-tournaments.db.part1/2/3` - Chunks (too large)
- `chess-stats.db` - Development database
- `chess-production.db` - Production variant
- Temporary database files (*.db-shm, *.db-wal, *.db-journal)

### Current .gitignore Configuration
```gitignore
# Database
*.sqlite
*.sqlite3
*.db
*.db-shm
*.db-wal
*.db-journal
!otb-database/railway-subset.db  # Exception for subset database
```

## Alternative Storage Solutions

### Option 1: GitHub Release (Current) ✅
- **Pros**: Free, reliable, CDN distribution, version controlled
- **Cons**: Manual upload process, 2GB file limit per file (requires chunking)
- **Status**: Currently implemented and working

### Option 2: Git LFS (Git Large File Storage)
- **Pros**: Integrated with git workflow, automatic handling
- **Cons**: Costs money after free tier (1GB free), slower downloads
- **Recommendation**: Not ideal for 5GB+ files

### Option 3: Cloud Storage (S3, Azure Blob, Google Cloud Storage)
- **Pros**: No file size limits, fast downloads, versioning
- **Cons**: Requires API keys, costs money, additional complexity
- **Recommendation**: Consider for future if database grows beyond 10GB

### Option 4: Database as a Service (PostgreSQL on Railway/Heroku)
- **Pros**: No file transfer needed, better performance, horizontal scaling
- **Cons**: Migration effort, different query syntax, potential costs
- **Recommendation**: Investigate for long-term production scalability

## Current Status ✅
- Database chunks uploaded to GitHub Release: database-v2
- Download script (`download-full-db.js`) working correctly
- Railway deployment successfully downloads and reassembles
- Local development can use railway-subset.db or download full database
- All database files properly excluded from git

## Future Considerations

### If Database Grows Beyond 10GB
1. **PostgreSQL Migration**: Consider migrating to managed PostgreSQL
2. **Incremental Updates**: Instead of full database, provide update scripts
3. **Partition Strategy**: Split by date ranges or rating categories
4. **Compression**: Investigate compression strategies (GZIP, ZSTD)

### Automation Opportunities
- GitHub Actions to automatically split and upload on database updates
- Automated testing of download and reassembly process
- Database versioning system with changelog

## Related Files
- `download-full-db.js` - Automated download and reassembly
- `split-database.js` / `split-db-v3.js` - Create chunks from full database
- `otb-database/railway-subset.db` - Smaller subset for development/testing
- `.gitignore` - Excludes large database files from git

## Questions & Answers

**Q: Why not use Git LFS?**
A: Git LFS has a 1GB free tier, and our database is 5.1GB. The costs add up quickly.

**Q: Can we compress the database?**
A: SQLite databases don't compress well with GZIP because they're already optimized. We'd save maybe 10-20%.

**Q: Should we track the chunks in git?**
A: No. They're too large, and GitHub Release is a better solution for binary assets.

**Q: What if GitHub Release becomes unavailable?**
A: We have backup options:
   1. Upload to alternative hosting (Cloudflare R2, BackBlaze B2)
   2. Use Railway volume persistence
   3. Migrate to PostgreSQL hosted database

**Q: How do I get the database for local development?**
A: Either download from GitHub Release or use the smaller `railway-subset.db` in otb-database/
