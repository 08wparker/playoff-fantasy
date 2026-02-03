/**
 * Season-specific configuration for the 2025-2026 NFL Playoffs.
 *
 * ============================================================================
 * UPDATE FOR NEW SEASON: Duplicate this file as season-YYYY.ts and update all values.
 * Or better: Move these values to Firebase (config/season collection) for admin editing.
 * ============================================================================
 *
 * This file consolidates season-specific data that was previously scattered across:
 * - src/data/players.ts (WEEK_LOCK_TIMES, PLAYOFF_TEAMS)
 * - src/services/espn.ts (PLAYOFF_WEEK_DATES)
 * - src/components/scoring/WeeklyPlayerStats.tsx (GAMES_BY_WEEK)
 * - src/components/analysis/Analysis.tsx (ELIMINATED_TEAMS_*)
 * - src/App.tsx (ADMIN_EMAILS)
 */

import type { NFLTeam, PlayoffWeekName } from '../types';

// Season identifier
export const SEASON_YEAR = '2025-2026';

/**
 * Admin email addresses with full access to admin panel.
 * TODO: Move to Firebase (config/admins) for easier management.
 */
export const ADMIN_EMAILS: string[] = [
  'william.f.parker@gmail.com',
];

/**
 * Roster lock times for each playoff week.
 * Times are in UTC. Rosters cannot be modified after these times.
 *
 * UPDATE EACH SEASON: Set to 30 minutes before the first game of each round.
 */
export const WEEK_LOCK_TIMES: Record<number, Date> = {
  1: new Date('2026-01-10T21:30:00Z'), // Wild Card: Jan 10, 2026 3:30 PM CST
  2: new Date('2026-01-17T21:30:00Z'), // Divisional: Jan 17, 2026 3:30 PM CST
  3: new Date('2026-01-25T20:00:00Z'), // Championship: Jan 25, 2026 2:00 PM CST
  4: new Date('2026-02-09T00:30:00Z'), // Super Bowl: Feb 8, 2026 6:30 PM CST
};

/**
 * ESPN API date ranges for each playoff week.
 * Format: YYYYMMDD-YYYYMMDD (inclusive range).
 * Used to filter scoreboard results to relevant games.
 *
 * UPDATE EACH SEASON: Set to span all game days for each round.
 */
export const ESPN_PLAYOFF_DATE_RANGES: Record<number, string> = {
  1: '20260110-20260114', // Wild Card: Jan 10-13, 2026 (Sat-Mon)
  2: '20260117-20260119', // Divisional: Jan 17-18, 2026 (Sat-Sun)
  3: '20260124-20260126', // Championship: Jan 25-26, 2026 (Sun)
  4: '20260208-20260209', // Super Bowl: Feb 8, 2026 (Sun)
};

/**
 * Initial playoff teams at the start of Wild Card round.
 * 14 teams total: 7 AFC + 7 NFC (top seeds in each conference get bye).
 *
 * UPDATE EACH SEASON: Set after regular season ends.
 */
export const INITIAL_PLAYOFF_TEAMS: NFLTeam[] = [
  // AFC (example - update each year)
  'BUF', 'NE', 'HOU', 'PIT', 'LAC', 'DEN', 'JAX',
  // NFC (example - update each year)
  'PHI', 'LAR', 'CHI', 'GB', 'SF', 'CAR', 'SEA',
];

/**
 * Teams eliminated after each playoff round.
 * Updated as games complete. Used for Analysis tab visualization.
 *
 * UPDATE DURING SEASON: After each round completes.
 * TODO: Move to Firebase for real-time updates via admin panel.
 */
export const ELIMINATED_TEAMS: Record<string, Set<NFLTeam>> = {
  // Teams eliminated after Wild Card (6 losers)
  afterWildcard: new Set<NFLTeam>(['PIT', 'LAC', 'TB', 'GB', 'MIN', 'WAS', 'CAR', 'JAX', 'PHI']),

  // Teams eliminated after Divisional (4 losers)
  afterDivisional: new Set<NFLTeam>(['BUF', 'CHI', 'SF', 'HOU']),

  // Teams eliminated after Championship (2 losers)
  afterChampionship: new Set<NFLTeam>(['DEN', 'LAR']),

  // Super Bowl loser (1 team) - set after game
  afterSuperbowl: new Set<NFLTeam>([]),
};

/**
 * Get eliminated teams for a given stats week.
 * Returns teams that can no longer be selected (their season is over).
 *
 * @param statsWeek - The week of stats being viewed (1-4)
 * @returns Set of team abbreviations that are eliminated
 */
export function getEliminatedTeamsForWeek(statsWeek: number): Set<NFLTeam> {
  switch (statsWeek) {
    case 1:
      return ELIMINATED_TEAMS.afterWildcard;
    case 2:
      return ELIMINATED_TEAMS.afterDivisional;
    case 3:
      return ELIMINATED_TEAMS.afterChampionship;
    case 4:
      return ELIMINATED_TEAMS.afterSuperbowl;
    default:
      return new Set();
  }
}

/**
 * Game results for each playoff round.
 * Used to display final scores in the Previous Stats tab.
 *
 * UPDATE DURING SEASON: After each game completes.
 * TODO: Auto-populate from ESPN API after games are final.
 */
export interface GameResult {
  shortName: string; // e.g., "LAR @ CAR"
  awayScore: number;
  homeScore: number;
  isOT?: boolean;
}

export const GAME_RESULTS: Record<PlayoffWeekName, GameResult[]> = {
  wildcard: [
    { shortName: 'LAR @ CAR', awayScore: 34, homeScore: 31 },
    { shortName: 'GB @ CHI', awayScore: 27, homeScore: 31 },
    { shortName: 'BUF @ JAX', awayScore: 27, homeScore: 24 },
    { shortName: 'SF @ PHI', awayScore: 23, homeScore: 19 },
    { shortName: 'LAC @ NE', awayScore: 3, homeScore: 16 },
    { shortName: 'HOU @ PIT', awayScore: 30, homeScore: 6 },
  ],
  divisional: [
    { shortName: 'BUF @ DEN', awayScore: 30, homeScore: 33, isOT: true },
    { shortName: 'HOU @ NE', awayScore: 16, homeScore: 28 },
    { shortName: 'SF @ SEA', awayScore: 6, homeScore: 41 },
    { shortName: 'CHI @ LAR', awayScore: 17, homeScore: 20, isOT: true },
  ],
  championship: [
    { shortName: 'NE @ DEN', awayScore: 10, homeScore: 7 },
    { shortName: 'LAR @ SEA', awayScore: 27, homeScore: 31 },
  ],
  superbowl: [
    // Fill in after Super Bowl
  ],
};

/**
 * CSV file paths for player rosters each week.
 * Files should be placed in public/data/.
 */
export const WEEK_CSV_FILES: Record<number, string> = {
  1: '/data/wildcard.csv',
  2: '/data/divisional.csv',
  3: '/data/championship.csv',
  4: '/data/superbowl.csv',
};

/**
 * Teams advancing to each round (inverse of eliminated teams).
 * Derived from ELIMINATED_TEAMS for convenience.
 */
export function getTeamsInRound(round: number): NFLTeam[] {
  const allTeams = new Set<NFLTeam>(INITIAL_PLAYOFF_TEAMS);

  if (round >= 2) {
    ELIMINATED_TEAMS.afterWildcard.forEach(t => allTeams.delete(t));
  }
  if (round >= 3) {
    ELIMINATED_TEAMS.afterDivisional.forEach(t => allTeams.delete(t));
  }
  if (round >= 4) {
    ELIMINATED_TEAMS.afterChampionship.forEach(t => allTeams.delete(t));
  }

  return Array.from(allTeams);
}

/**
 * Super Bowl matchup (set after Conference Championships).
 */
export const SUPER_BOWL_TEAMS: { afc: NFLTeam; nfc: NFLTeam } = {
  afc: 'NE',
  nfc: 'SEA',
};
