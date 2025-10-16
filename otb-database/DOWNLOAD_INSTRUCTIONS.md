# OTB Database Download Instructions

## Lumbras Gigabase Download Guide

### Step 1: Visit Lumbras Gigabase
Go to: https://lumbrasgigabase.com/en/download-in-pgn-format-en/

### Step 2: Recommended Downloads

#### For Quick Start (Smaller Files):
1. **Recent Tournaments (2023-2024)**
   - Contains latest super-tournaments
   - Includes World Championship matches
   - File size: ~50-100 MB

2. **Top Players Collection**
   - Games from top 100 players
   - High-quality games only
   - File size: ~100-200 MB

#### For Comprehensive Database:
1. **Complete 2023 Database**
   - All major tournaments from 2023
   - File size: ~500 MB - 1 GB

2. **World Championships Collection**
   - All World Championship games
   - Historical significance
   - File size: ~50 MB

3. **Classical Games Collection**
   - Pre-computer era games
   - Historical masterpieces
   - File size: ~200 MB

### Step 3: Download Process
1. Click on desired database link
2. Some files may require free registration
3. Download will be in ZIP format
4. Save to your Downloads folder

### Step 4: Extract and Move Files
1. Extract ZIP files to get PGN files
2. Move PGN files to:
   ```
   C:\Users\micha\OneDrive\Desktop\Code\Chess Stats\otb-database\pgn-files\
   ```

### Step 5: Verify Installation
Run this command to scan files:
```bash
node otb-database/download-manager.js scan
```

---

## Alternative Free Sources

### 1. The Week in Chess (TWIC)
- Weekly updates with latest games
- Download latest: 
  ```bash
  node otb-database/download-manager.js twic
  ```

### 2. PGN Mentor
- Historical games collection
- Website: http://www.pgnmentor.com/files.html
- Recommended downloads:
  - `players.zip` - Games by famous players
  - `events.zip` - Major tournaments
  - `openings.zip` - Games sorted by opening

### 3. Lichess Database
- Monthly database dumps
- Website: https://database.lichess.org/
- Standard games: Download latest month
- File size: 10-15 GB compressed

### 4. Chess.com Public Data
- Some public tournament PGNs available
- Check Chess.com/games/library

---

## File Naming Convention

Please rename files for better organization:
- `lumbras_2024_tournaments.pgn`
- `lumbras_world_championships.pgn`
- `lumbras_top_players.pgn`
- `twic_latest.pgn`
- `lichess_2024_01.pgn`

---

## Testing Your Database

After downloading, test with:

1. **Check available files:**
   ```bash
   curl http://localhost:3005/api/otb/files
   ```

2. **Get database stats:**
   ```bash
   curl http://localhost:3005/api/otb/stats
   ```

3. **Search for games:**
   ```bash
   curl "http://localhost:3005/api/otb/search?player=Carlsen&minElo=2700"
   ```

4. **Analyze openings:**
   ```bash
   curl "http://localhost:3005/api/otb/analyze/your-file.pgn?type=openings"
   ```

---

## Storage Requirements

- Small collection (top players): ~500 MB
- Medium collection (recent years): ~2-5 GB  
- Large collection (comprehensive): ~10-20 GB
- Complete Lichess database: ~100 GB uncompressed

---

## Performance Tips

1. Start with smaller files for testing
2. Index files by player/event for faster searches
3. Consider using a database for large collections
4. Keep monthly archives separate for easier management

---

## Legal Notice

- Lumbras Gigabase is free for personal use
- Respect copyright for commercial use
- TWIC and Lichess data is open source
- Always check individual tournament copyrights