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
- Playoff weeks: wildcard, divisional, championship, superbowl (weeks 1-4)

### Scoring System
Scoring rules stored in Firebase (`config/scoringRules`) and can be modified via Admin tab:
- **Passing**: 1 pt per 25 yds, 4 pts/TD, -2 pts/INT
- **Rushing/Receiving**: 1 pt per 10 yds, 6 pts/TD, 1 pt/reception (PPR)
- **Field Goals**: 3 pts (0-39 yds), 4 pts (40-49 yds), 5 pts (50+ yds), -1 pt missed
- **Extra Points**: 1 pt made, -1 pt missed
- **Defense**: Points based on points allowed (shutout=10, scales down), plus sacks, INTs, fumble recoveries, defensive TDs

### Firebase Collections
- `players/` - Player cache with ESPN headshots
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

### Data Sources
- **Player rosters**: CSV files in `public/data/` (e.g., `wildcard.csv`, `divisional.csv`)
- **CSV format**: `player,position,team` (ranks stored separately in Firebase)
- **Player images**: ESPN headshots fetched during admin sync
- **Player stats**: Manually entered via Admin Stats UI, or auto-synced from ESPN Live Stats
- **Live stats**: ESPN API (`site.api.espn.com/apis/site/v2/sports/football/nfl/summary`)

### Key Files
- `src/types/index.ts` - TypeScript types including `PlayoffWeekName`, `PlayerStats`, `ScoringRules`
- `src/services/scoring.ts` - Scoring rules interface, `calculatePoints()`, position-aware scoring
- `src/services/firebase.ts` - All Firestore operations (players, rosters, stats, config)
- `src/services/espn.ts` - ESPN API integration for live stats, box scores, game fetching
- `src/hooks/useScoring.ts` - Multi-week standings calculation
- `src/hooks/useCurrentWeek.ts` - Current week detection (date-based or admin override)

### Component Structure

**App Tabs** (defined in `src/components/layout/TabNav.tsx`):
- `roster` - Build weekly roster
- `wildcard-stats` - View saved Wild Card player stats
- `live` - Live ESPN stats during games
- `scores` - Scoreboard with overall + per-week standings
- `admin` - Admin tools (only visible to admin emails)

**User Components**:
- `App.tsx` - Auth provider, tab navigation, admin detection
- `components/roster/RosterBuilder.tsx` - Roster building with player selection modal
- `components/roster/AvailablePlayers.tsx` - Player picker, filters out used players
- `components/scoring/Scoreboard.tsx` - Overall standings + per-week tabs with player breakdowns, weekly summaries
- `components/scoring/LiveStats.tsx` - Real-time ESPN stats with auto-sync to Firebase
- `components/scoring/WeeklyPlayerStats.tsx` - Display saved stats for a completed week

**Admin Components** (`src/components/admin/`):
- `AdminSync.tsx` - Sync players from CSV per week with ESPN headshots
- `AdminStats.tsx` - Spreadsheet UI for entering/editing player stats, clear stats button
- `AdminScoringRules.tsx` - Edit scoring rules
- `AdminWeek.tsx` - Override current playoff week
- `AdminRosterLock.tsx` - Lock all rosters for a week (adds players to usedPlayers)
- `AdminUsers.tsx` - View users, toggle payment status, manage usedPlayers (sync/reset)
- `AdminLiveStats.tsx` - Enable/disable live ESPN stats syncing
- `AdminScoreboardTab.tsx` - Set default scoreboard sub-tab
- `AdminWeeklySummary.tsx` - Generate/save AI weekly recap summaries

### ESPN Live Stats Integration
- `src/services/espn.ts` handles all ESPN API calls
- `fetchNFLScoreboard(playoffWeek?)` - Get games for a playoff week using date ranges
- `fetchGameBoxScore(gameId)` - Get detailed box score with player stats
- Playoff week dates configured in `PLAYOFF_WEEK_DATES` constant
- Auto-syncs matched players to Firebase every 60 seconds when enabled
- Parses: passing, rushing, receiving, kicking (with FG distance breakdown), defense stats

### Admin User Management
The `AdminUsers` component allows:
- View all registered users with payment status
- Expand user to see UID and usedPlayers list
- Sync roster to usedPlayers by week (Wk 1-4 buttons) - for fixing missing usedPlayers
- Reset usedPlayers to empty - for correcting sync mistakes

### Important Gotchas
- Player IDs can change if re-synced with ESPN data (ESPN ID vs CSV-generated ID)
- `usedPlayers` enforcement happens client-side in `AvailablePlayers.tsx`
- When locking rosters, players are added to `usedPlayers` via `lockAllRostersForWeek()`
- Defense stats use opponent's offensive stats (INTs thrown → defensive INTs caught)
- Defensive TDs and fumble recoveries come from team stats, not swapped

## Firebase Configuration

Firebase config is loaded from environment variables (VITE_FIREBASE_*). Create a `.env` file with your Firebase project credentials.

## Admin Access

Admin emails are defined in `App.tsx`:
```typescript
const ADMIN_EMAILS = ['william.f.parker@gmail.com'];
```
