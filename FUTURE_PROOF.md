# Future-Proofing the Playoff Fantasy App

This document outlines changes needed to make the app more reusable year-over-year without requiring code changes each playoff week.

## Executive Summary

**Current Pain Points:**
1. Hardcoded dates, game results, and eliminated teams scattered across 6+ files
2. ESPN API integration is fragile with no fallback mechanisms
3. Week configuration duplicated in multiple places
4. No admin UI for season setup - requires code changes

**Proposed Solution:**
1. Centralize all season-specific data into Firebase + one config file
2. Create Admin Season Setup UI for year-over-year configuration
3. Add resilience to ESPN integration with better error handling
4. Consolidate week definitions into a single source of truth

---

## Files Requiring Annual Updates (Current State)

### Critical - Must Update Each Season

| File | Lines | What's Hardcoded |
|------|-------|------------------|
| `src/data/players.ts` | 19-24 | `WEEK_LOCK_TIMES` - Roster lock dates |
| `src/services/espn.ts` | 110-115 | `PLAYOFF_WEEK_DATES` - ESPN API date ranges |
| `src/components/scoring/WeeklyPlayerStats.tsx` | 25-45 | `GAMES_BY_WEEK` - Final game scores |
| `src/components/analysis/Analysis.tsx` | 20-30 | Eliminated teams by round |
| `src/services/espnApi.ts` | 29-40 | `PLAYOFF_TEAMS_2024` - Participating teams |
| `public/data/*.csv` | all | Player rosters for each week |

### Medium Priority

| File | Lines | Issue |
|------|-------|-------|
| `src/App.tsx` | 29 | `ADMIN_EMAILS` hardcoded |
| Multiple files | various | Week number/name mapping duplicated |
| `src/components/analysis/Analysis.tsx` | 397 | Default stats week hardcoded |

---

## Proposed Architecture

### 1. Firebase Season Configuration

Move all season-specific data to Firebase under `config/season/`:

```typescript
// Firebase: config/season
{
  year: "2025-2026",

  // Playoff schedule
  weeks: {
    1: {
      name: "wildcard",
      label: "Wild Card",
      lockTime: "2026-01-10T21:30:00Z",
      dateRange: { start: "2026-01-10", end: "2026-01-13" },
      teams: ["BUF", "PHI", "NE", "LAR", "JAX", "CHI", "GB", "LAC", "SF", "HOU", "PIT", "CAR"],
      games: [
        { away: "LAR", home: "CAR", awayScore: 34, homeScore: 31 },
        // ... populated after games complete
      ]
    },
    2: { /* divisional */ },
    3: { /* championship */ },
    4: { /* superbowl */ }
  },

  // Elimination tracking (updated after each round)
  eliminatedTeams: {
    afterWeek1: ["PIT", "LAC", "TB", "GB", "MIN", "WAS"],
    afterWeek2: ["BUF", "CHI", "SF", "HOU"],
    afterWeek3: ["DEN", "LAR"]
  },

  // Admin configuration
  admins: ["william.f.parker@gmail.com"]
}
```

### 2. New Files to Create

```
src/
├── config/
│   ├── season.ts          # Season config type definitions & defaults
│   └── weeks.ts           # Centralized week configuration (single source of truth)
├── hooks/
│   └── useSeasonConfig.ts # Hook to fetch season config from Firebase
├── components/
│   └── admin/
│       └── AdminSeasonSetup.tsx  # UI for season setup
```

### 3. Centralized Week Configuration

Create `src/config/weeks.ts`:

```typescript
import type { PlayoffWeekName } from '../types';

export interface WeekConfig {
  number: number;
  name: PlayoffWeekName;
  label: string;
  shortLabel: string;
}

export const PLAYOFF_WEEKS: WeekConfig[] = [
  { number: 1, name: 'wildcard', label: 'Wild Card', shortLabel: 'WC' },
  { number: 2, name: 'divisional', label: 'Divisional', shortLabel: 'DIV' },
  { number: 3, name: 'championship', label: 'Conference Championships', shortLabel: 'CONF' },
  { number: 4, name: 'superbowl', label: 'Super Bowl', shortLabel: 'SB' },
];

// Helper functions
export const getWeekByNumber = (num: number) => PLAYOFF_WEEKS.find(w => w.number === num);
export const getWeekByName = (name: PlayoffWeekName) => PLAYOFF_WEEKS.find(w => w.name === name);
export const weekNumberToName = (num: number): PlayoffWeekName => getWeekByNumber(num)?.name ?? 'wildcard';
export const weekNameToNumber = (name: PlayoffWeekName): number => getWeekByName(name)?.number ?? 1;
```

---

## ESPN API Resilience

### Current Fragility Points

1. **FG distance parsing** - Regex assumes specific ESPN text format
2. **Position ID mapping** - Hardcoded ESPN position IDs
3. **Team abbreviation mapping** - ESPN uses different abbrevs sometimes
4. **Date filtering** - Relies on exact date range format

### Recommended Improvements

```typescript
// src/services/espn.ts

// 1. Add retry logic with exponential backoff
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries = 3
): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      console.warn(`ESPN API attempt ${i + 1} failed:`, error);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
  return null;
}

// 2. Add fallback for team mapping
function normalizeTeamAbbr(espnAbbr: string): NFLTeam | null {
  const normalized = ESPN_TEAM_MAP[espnAbbr.toUpperCase()];
  if (!normalized) {
    console.warn(`Unknown team abbreviation from ESPN: ${espnAbbr}`);
    // Could log to Firebase for tracking unknown mappings
  }
  return normalized ?? null;
}

// 3. Graceful FG parsing with fallback
function parseFGDistance(playText: string): number {
  // Try primary pattern
  let match = playText.match(/(\d+)\s+Yd\s+Field\s+Goal/i);
  if (match) return parseInt(match[1], 10);

  // Try alternative patterns ESPN might use
  match = playText.match(/(\d+)-yard\s+field\s+goal/i);
  if (match) return parseInt(match[1], 10);

  match = playText.match(/FG\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Default if unparseable - log for debugging
  console.warn(`Could not parse FG distance from: ${playText}`);
  return 40; // Default to middle tier
}
```

---

## Admin Season Setup UI

New component at `src/components/admin/AdminSeasonSetup.tsx`:

### Features:
1. **Season Year** - Set the current season (e.g., "2025-2026")
2. **Week Schedule** - Configure lock times for each week
3. **Team Management** - Add/remove teams from each playoff round
4. **Game Results** - Enter final scores after games complete
5. **Elimination Tracking** - Mark which teams are eliminated after each round
6. **Import/Export** - Save/load season config as JSON

### Workflow:
1. **Pre-season** (December): Set up week dates and initial teams
2. **Each week**: After games, enter results and update eliminated teams
3. **Live sync**: ESPN integration auto-populates stats, admin verifies

---

## Migration Plan

### Phase 1: Centralize Configuration (Low Risk)
- [ ] Create `src/config/weeks.ts` with centralized week definitions
- [ ] Update all files to import from central location
- [ ] No behavior change, just consolidation

### Phase 2: Add Firebase Season Config (Medium Risk)
- [ ] Add `config/season` collection to Firebase
- [ ] Create `useSeasonConfig` hook
- [ ] Create `AdminSeasonSetup` component
- [ ] Gradually migrate hardcoded values to Firebase

### Phase 3: ESPN Resilience (Low Risk)
- [ ] Add retry logic to ESPN fetches
- [ ] Add fallback patterns for FG parsing
- [ ] Add logging for unknown team/position mappings
- [ ] Create manual stats entry fallback in admin

### Phase 4: Remove Hardcoded Data (Requires Testing)
- [ ] Lock times from Firebase instead of code
- [ ] Eliminated teams from Firebase instead of code
- [ ] Game scores from Firebase instead of code
- [ ] Validate all flows work with Firebase-only data

---

## Immediate Quick Wins (No Architecture Change)

These can be done right now to reduce annual pain:

### 1. Single Config File
Create `src/config/season-2025-2026.ts`:

```typescript
// src/config/season-2025-2026.ts
// ALL season-specific hardcoded values in ONE place

export const SEASON = '2025-2026';

export const LOCK_TIMES = {
  1: new Date('2026-01-10T21:30:00Z'),
  2: new Date('2026-01-17T21:30:00Z'),
  3: new Date('2026-01-25T20:00:00Z'),
  4: new Date('2026-02-09T00:30:00Z'),
};

export const ESPN_DATE_RANGES = {
  1: '20260110-20260114',
  2: '20260117-20260119',
  3: '20260124-20260126',
  4: '20260208-20260209',
};

export const PLAYOFF_TEAMS = [
  'BUF', 'PHI', 'NE', 'LAR', 'JAX', 'CHI', 'GB', 'LAC', 'SF', 'HOU', 'PIT', 'CAR',
];

export const ELIMINATED_TEAMS = {
  afterWildcard: new Set(['PIT', 'LAC', 'TB', 'GB', 'MIN', 'WAS', 'CAR', 'JAX', 'PHI']),
  afterDivisional: new Set(['BUF', 'CHI', 'SF', 'HOU']),
  afterChampionship: new Set(['DEN', 'LAR']),
};

export const GAME_RESULTS = {
  wildcard: [
    { shortName: 'LAR @ CAR', awayScore: 34, homeScore: 31 },
    // ...
  ],
  // ...
};
```

Then update all files to import from this single source. Next year, duplicate the file as `season-2026-2027.ts` and update values.

### 2. Add Comments for Future-Self
Add clear `// UPDATE FOR NEW SEASON` comments at every hardcoded value.

---

## Appendix: Files to Modify

### When Implementing Centralized Config

1. `src/data/players.ts` → import lock times from config
2. `src/services/espn.ts` → import date ranges from config
3. `src/services/espnApi.ts` → import playoff teams from config
4. `src/components/scoring/WeeklyPlayerStats.tsx` → import game results from config
5. `src/components/analysis/Analysis.tsx` → import eliminated teams from config
6. `src/App.tsx` → import admin emails from config

### When Adding Firebase Season Config

1. `src/services/firebase.ts` → add season config functions
2. Create `src/hooks/useSeasonConfig.ts`
3. Create `src/components/admin/AdminSeasonSetup.tsx`
4. Update `src/components/admin/Admin.tsx` → add season setup tab
