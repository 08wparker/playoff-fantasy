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

## Custom Slash Commands

- `/commit-push` - Stage all changes, commit with message, and push to remote

## Architecture Overview

This is a React 19 + TypeScript + Vite application for NFL playoff fantasy football. Uses Firebase for authentication and data persistence, Tailwind CSS for styling.

### Core Game Mechanics
- PPR (point-per-reception) scoring system with admin-configurable rules
- Roster: 1 QB, 2 RB, 3 WR, 1 TE, 1 D/ST, 1 K
- **Key constraint**: Each player can only be used once across all playoff weeks
- Playoff weeks: wildcard, divisional, championship, superbowl

### Scoring System
Scoring rules stored in Firebase (`config/scoringRules`) and can be modified via Admin tab:
- **Passing**: 1 pt per 25 yds, 4 pts/TD, -2 pts/INT
- **Rushing/Receiving**: 1 pt per 10 yds, 6 pts/TD, 1 pt/reception (PPR)
- **Field Goals**: 3 pts (0-39 yds), 4 pts (40-49 yds), 5 pts (50+ yds), -1 pt missed
- **Extra Points**: 1 pt made, -1 pt missed
- **Defense**: Points based on points allowed (shutout=10, scales down), plus sacks, INTs, fumbles, TDs

### Firebase Collections
- `players/` - Player cache with ESPN headshots
- `playoffConfig/{weekName}` - Teams participating each playoff week
- `playerRanks/{weekName}/ranks/` - Player rankings per week
- `playerStats/{weekName}/stats/{playerId}` - Weekly player statistics
- `rosters/{odId}/weeks/{weekNumber}` - User rosters per week
- `usedPlayers/{odId}` - Players already used by each user
- `users/{odId}` - User profiles
- `config/scoringRules` - Admin-configurable scoring rules

### Data Sources
- **Player rosters**: CSV files in `public/data/` (e.g., `wildcard.csv`, `divisional.csv`)
- **CSV format**: `player,position,team` (ranks stored separately in Firebase)
- **Player images**: ESPN headshots fetched during admin sync
- **Player stats**: Manually entered via Admin Stats spreadsheet UI

### Key Files
- `src/types/index.ts` - TypeScript types including `PlayoffWeekName`, `PlayerStats`, `ScoringRules`
- `src/services/scoring.ts` - Scoring rules interface, `calculatePoints()`, position-aware scoring
- `src/services/firebase.ts` - All Firestore operations (players, rosters, stats, config)
- `src/hooks/useScoring.ts` - Multi-week standings calculation

### Component Structure
- `App.tsx` - Auth provider, tab navigation (Roster, Scores, Admin)
- `components/roster/` - Roster building, player selection, ScoringRubric display
- `components/scoring/Scoreboard.tsx` - Overall standings + per-week tabs with player breakdowns
- `components/admin/AdminSync.tsx` - Sync players from CSV per week
- `components/admin/AdminStats.tsx` - Spreadsheet UI for entering player stats
- `components/admin/AdminScoringRules.tsx` - Edit scoring rules

## Firebase Configuration

Firebase config is loaded from environment variables (VITE_FIREBASE_*). Create a `.env` file with your Firebase project credentials.
