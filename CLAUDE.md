# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands should be run from the `playoff-fantasy/` directory:

```bash
npm run dev      # Start Vite dev server
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Deployment

```bash
npm run build && firebase deploy --only hosting
```

Hosting URL: https://playoff-fantasy-173e1.web.app

## Custom Slash Commands

- `/commit-push` - Stage all changes, commit with message, and push to remote

## Architecture Overview

This is a React 19 + TypeScript + Vite application for NFL playoff fantasy football. Uses Firebase for authentication and data persistence, Tailwind CSS for styling.

### Core Game Mechanics
- PPR (point-per-reception) scoring system with admin-configurable rules
- Roster: 1 QB, 2 RB, 3 WR, 1 TE, 1 D/ST, 1 K
- **Key constraint**: Each player can only be used once across all playoff weeks
- Playoff weeks: wildcard (1), divisional (2), championship (3), superbowl (4)
- Week determined by date ranges in `src/data/players.ts` or admin override

### 2024-25 Playoff Structure
- **Wild Card teams**: PIT, LAC, TB, GB, MIN, WAS, BUF, DEN, NE, HOU, CHI, LAR, SEA, SF, CAR, JAX, PHI (some were placeholders)
- **Divisional teams**: BUF, DEN, NE, HOU, CHI, LAR, SEA, SF
- **Championship teams**: SEA, LAR, DEN, NE
- **Super Bowl teams**: SEA vs NE

### Eliminated Teams by Round (for Analysis tab)
Tracked in `src/components/analysis/Analysis.tsx`:
- After Wild Card: PIT, LAC, TB, GB, MIN, WAS, CAR, JAX, PHI
- After Divisional: BUF, CHI, SF, HOU
- After Championship: DEN, LAR

### Scoring System
Scoring rules stored in Firebase (`config/scoringRules`) and can be modified via Admin tab:
- **Passing**: 1 pt per 25 yds, 4 pts/TD, -2 pts/INT
- **Rushing/Receiving**: 1 pt per 10 yds, 6 pts/TD, 1 pt/reception (PPR)
- **Field Goals**: 3 pts (0-39 yds), 4 pts (40-49 yds), 5 pts (50+ yds), -1 pt missed
- **Extra Points**: 1 pt made, -1 pt missed
- **Defense**: Points based on points allowed (shutout=10, scales down), plus sacks, INTs, fumble recoveries, defensive TDs

### Firebase Collections
- `players/` - Player cache with ESPN headshots (keyed by generated ID)
- `playoffConfig/{weekName}` - Teams participating each playoff week
- `playerRanks/{weekName}/players/` - Player rankings per week
- `playerStats/{weekName}/players/{playerId}` - Weekly player statistics
- `rosters/{odId}/weeks/{weekNumber}` - User rosters per week
- `usedPlayers/{odId}` - Players already used by each user (array of player IDs)
- `users/{odId}` - User profiles (displayName, email, photoURL, hasPaid)
- `config/scoringRules` - Admin-configurable scoring rules
- `config/currentWeek` - Override for current playoff week (null = auto by date)
- `config/liveStats` - Enable/disable live ESPN stats syncing
- `config/scoreboardTab` - Default scoreboard sub-tab for users
- `weeklySummaries/{weekName}` - AI-generated weekly recap summaries

### Data Sources & File Organization

**Player CSV files** in `public/data/`:
- `wildcard.csv` - Wild Card week players
- `divisional.csv` - Divisional week players
- `championship.csv` - Championship week players
- `superbowl.csv` - Super Bowl players (SEA vs NE)
- Format: `player,position,team,rank`

**FantasyPros rankings** (reference only) in `public/data/rankings/`:
- `rankings/week20/` - Wild Card rankings by position
- `rankings/week21/` - Divisional rankings by position
- `rankings/week22/` - Championship/Super Bowl rankings by position

**Week lock times** defined in `src/data/players.ts` (`WEEK_LOCK_TIMES`):
- Wild Card: Jan 11, 2025 4:30 PM ET
- Divisional: Jan 18, 2025 4:30 PM ET
- Championship: Jan 25, 2025 2:00 PM CST (8:00 PM UTC)
- Super Bowl: Feb 8, 2026 6:30 PM CST

### Key Files
- `src/types/index.ts` - TypeScript types including `PlayoffWeekName`, `PlayerStats`, `ScoringRules`
- `src/services/scoring.ts` - Scoring rules interface, `calculatePoints()`, position-aware scoring
- `src/services/firebase.ts` - All Firestore operations (players, rosters, stats, config)
- `src/services/espn.ts` - ESPN API integration for live stats, box scores, game fetching
- `src/hooks/useScoring.ts` - Multi-week standings calculation
- `src/hooks/useCurrentWeek.ts` - Current week detection (date-based or admin override)
- `src/data/players.ts` - Week CSV paths, lock times, week date ranges

### Component Structure

**App Tabs** (defined in `src/components/layout/TabNav.tsx`):
- `roster` - Build weekly roster (shows current week name)
- `previous-stats` - View saved stats for completed weeks (Wild Card, Divisional, Championship)
- `live` - Live ESPN stats during games
- `scores` - Scoreboard with overall + per-week standings
- `analysis` - Roster analysis, top scorers charts, winning rosters breakdown
- `admin` - Admin tools (only visible to admin emails)

**User Components**:
- `App.tsx` - Auth provider, tab navigation, admin detection
- `components/roster/RosterBuilder.tsx` - Roster building with player selection modal
- `components/roster/AvailablePlayers.tsx` - Player picker, filters out used players
- `components/scoring/Scoreboard.tsx` - Overall standings + per-week tabs with player breakdowns
- `components/scoring/LiveStats.tsx` - Real-time ESPN stats with auto-sync to Firebase
- `components/scoring/WeeklyPlayerStats.tsx` - Display saved stats for completed weeks with game scores

**Analysis Components** (`src/components/analysis/`):
- `Analysis.tsx` - Main analysis view with:
  - Previous Week Stats: Top scorers chart by position with eliminated/available indicators
  - Chart supports negative scores (important for kickers)
  - "What Did the Winners Pick?" - Top 5 rosters with consensus picks and galaxy brain picks
  - Player Selection Frequency - Bar charts showing most picked players
  - Configurable week selector (Wild Card, Divisional, Championship)

**Admin Components** (`src/components/admin/`):
- `AdminSync.tsx` - Sync players from CSV per week with ESPN headshots
- `AdminStats.tsx` - Spreadsheet UI for entering/editing player stats, ESPN re-sync, clear stats
- `AdminScoringRules.tsx` - Edit scoring rules
- `AdminWeek.tsx` - Override current playoff week
- `AdminRosterLock.tsx` - Lock all rosters for a week (adds players to usedPlayers)
- `AdminUsers.tsx` - View users, toggle payment status, manage usedPlayers (sync/reset)
- `AdminLiveStats.tsx` - Enable/disable live ESPN stats syncing
- `AdminScoreboardTab.tsx` - Set default scoreboard sub-tab
- `AdminWeeklySummary.tsx` - Generate/save AI weekly recap summaries
- `AdminManualRoster.tsx` - Manually add rosters for users who missed the deadline

### ESPN Live Stats Integration
- `src/services/espn.ts` handles all ESPN API calls
- `fetchNFLScoreboard(playoffWeek?)` - Get games for a playoff week using date ranges
- `fetchGameBoxScore(gameId)` - Get detailed box score with player stats
- Playoff week dates configured in `PLAYOFF_WEEK_DATES` constant
- Auto-syncs matched players to Firebase every 60 seconds when enabled
- Parses: passing, rushing, receiving, kicking (with FG distance breakdown), defense stats

### Game Scores (for WeeklyPlayerStats display)
Hardcoded in `src/components/scoring/WeeklyPlayerStats.tsx` (`GAMES_BY_WEEK`):

**Wild Card**:
- PIT @ BUF: 17-31, LAC @ HOU: 12-32
- DEN @ BUF: 7-31, GB @ PHI: 22-10
- WAS @ TB: 23-20, MIN @ LAR: 27-9
- (Additional games as applicable)

**Divisional**:
- CHI @ LAR: 20-44, DEN @ BUF: 14-38
- SF @ SEA: 23-31, NE @ HOU: 24-5

**Championship**:
- NE @ DEN: 10-7, LAR @ SEA: 27-31

### Admin User Management
The `AdminUsers` component allows:
- View all registered users with payment status
- Expand user to see UID and usedPlayers list
- Sync roster to usedPlayers by week (Wk 1-4 buttons) - for fixing missing usedPlayers
- Reset usedPlayers to empty - for correcting sync mistakes

### Admin Manual Roster Entry
The `AdminManualRoster` component (`src/components/admin/AdminManualRoster.tsx`):
- For adding rosters for users who missed the deadline
- Select user from dropdown, pick players for each position
- Auto-locks roster and adds players to usedPlayers
- Uses dynamic week from `useCurrentWeek` hook

### Important Gotchas
- Player IDs can change if re-synced with ESPN data (ESPN ID vs CSV-generated ID)
- `usedPlayers` enforcement happens client-side in `AvailablePlayers.tsx`
- When locking rosters, players are added to `usedPlayers` via `lockAllRostersForWeek()`
- Defense stats use opponent's offensive stats (INTs thrown → defensive INTs caught)
- Defensive TDs and fumble recoveries come from team stats, not swapped
- Analysis chart must handle negative scores (kickers can go negative from missed FGs)
- Week lock times are in UTC in the code, convert from local time carefully

## Firebase Configuration

Firebase config is loaded from environment variables (VITE_FIREBASE_*). Create a `.env` file with your Firebase project credentials.

## Admin Access

Admin emails are defined in `App.tsx`:
```typescript
const ADMIN_EMAILS = ['william.f.parker@gmail.com'];
```

## Current Season Status (2024-25 Playoffs)

- Wild Card: Complete
- Divisional: Complete
- Championship: Complete (SEA and NE advanced)
- Super Bowl: Upcoming (SEA vs NE)
- 23 teams in the pool
- Leader after Championship: JJ Parker (429.8 pts)
