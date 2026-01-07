// User types
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  hasPaid?: boolean;
}

// Player positions
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

// Playoff week names
export type PlayoffWeekName = 'wildcard' | 'divisional' | 'championship' | 'superbowl';

export const PLAYOFF_WEEK_NAMES: Record<number, PlayoffWeekName> = {
  1: 'wildcard',
  2: 'divisional',
  3: 'championship',
  4: 'superbowl',
};

export const PLAYOFF_WEEK_DISPLAY_NAMES: Record<PlayoffWeekName, string> = {
  wildcard: 'Wild Card',
  divisional: 'Divisional',
  championship: 'Championship',
  superbowl: 'Super Bowl',
};

// NFL Team abbreviations
export type NFLTeam =
  | 'ARI' | 'ATL' | 'BAL' | 'BUF' | 'CAR' | 'CHI' | 'CIN' | 'CLE'
  | 'DAL' | 'DEN' | 'DET' | 'GB' | 'HOU' | 'IND' | 'JAX' | 'KC'
  | 'LAC' | 'LAR' | 'LV' | 'MIA' | 'MIN' | 'NE' | 'NO' | 'NYG'
  | 'NYJ' | 'PHI' | 'PIT' | 'SEA' | 'SF' | 'TB' | 'TEN' | 'WAS';

// Player data
export interface Player {
  id: string;
  name: string;
  team: NFLTeam;
  position: Position;
  imageUrl?: string;
  rank?: number;
}

// Player stats for scoring
export interface PlayerStats {
  playerId: string;
  week: number;
  // Passing
  passingYards: number;
  passingTDs: number;
  interceptions: number;
  // Rushing
  rushingYards: number;
  rushingTDs: number;
  // Receiving
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  // Kicking - Field Goals by distance
  fg0_39: number;      // FGs made from 0-39 yards
  fg40_49: number;     // FGs made from 40-49 yards
  fg50Plus: number;    // FGs made from 50+ yards
  fgMissed: number;    // Missed/blocked FGs
  // Kicking - Extra Points
  xpMade: number;      // Extra points made
  xpMissed: number;    // Extra points missed
  // Defense
  pointsAllowed: number;
  sacks: number;
  defensiveInterceptions: number;
  fumbleRecoveries: number;
  defensiveTDs: number;
}

// Roster slot types
export type RosterSlot = 'qb' | 'rb1' | 'rb2' | 'wr1' | 'wr2' | 'wr3' | 'te' | 'dst' | 'k';

// Weekly roster
export interface WeeklyRoster {
  odId: string;
  week: number;
  qb: string | null;
  rb1: string | null;
  rb2: string | null;
  wr1: string | null;
  wr2: string | null;
  wr3: string | null;
  te: string | null;
  dst: string | null;
  k: string | null;
  locked: boolean;
  totalPoints: number;
}

// Used players tracking
export interface UsedPlayers {
  odId: string;
  players: string[]; // Array of player IDs
}

// Playoff week info
export interface PlayoffWeek {
  week: number;
  name: string; // "Wild Card", "Divisional", "Conference", "Super Bowl"
  teams: NFLTeam[];
  lockTime: Date;
}

// Playoff config per week (stored in Firebase)
export interface PlayoffConfig {
  weekName: PlayoffWeekName;
  teams: NFLTeam[];
  updatedAt?: Date;
}

// Player rank per week (stored in Firebase)
export interface PlayerRank {
  playerId: string;
  rank: number;
}

// Scoring summary for display
export interface PlayerScore {
  player: Player;
  stats: PlayerStats;
  points: number;
}

export interface RosterScore {
  user: User;
  roster: WeeklyRoster;
  playerScores: PlayerScore[];
  totalPoints: number;
}

// Roster slot configuration
export const ROSTER_SLOTS: { slot: RosterSlot; position: Position; label: string }[] = [
  { slot: 'qb', position: 'QB', label: 'QB' },
  { slot: 'rb1', position: 'RB', label: 'RB' },
  { slot: 'rb2', position: 'RB', label: 'RB' },
  { slot: 'wr1', position: 'WR', label: 'WR' },
  { slot: 'wr2', position: 'WR', label: 'WR' },
  { slot: 'wr3', position: 'WR', label: 'WR' },
  { slot: 'te', position: 'TE', label: 'TE' },
  { slot: 'dst', position: 'DST', label: 'D/ST' },
  { slot: 'k', position: 'K', label: 'K' },
];
