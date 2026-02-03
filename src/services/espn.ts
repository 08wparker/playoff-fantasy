/**
 * ESPN API Service for fetching live NFL stats.
 * Note: This is an unofficial API - no auth required but could change without notice.
 *
 * FRAGILITY WARNING: ESPN can change their API format at any time.
 * Key areas to monitor:
 * - Team abbreviation mappings (ESPN_TEAM_MAP)
 * - FG distance text parsing (parseFGDistance)
 * - Box score response structure
 *
 * RESILIENCE FEATURES:
 * - Retry with exponential backoff
 * - Multiple FG distance parsing patterns
 * - Unknown team/position logging
 * - Graceful fallbacks for parsing failures
 */

import type { PlayerStats, NFLTeam } from '../types';
import { ESPN_PLAYOFF_DATE_RANGES } from '../config/season';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ESPN team abbreviation mapping to our format
// UPDATE: Add new mappings here if ESPN introduces new abbreviations
const ESPN_TEAM_MAP: Record<string, NFLTeam> = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF',
  'CAR': 'CAR', 'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE',
  'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GB': 'GB',
  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 'KC': 'KC',
  'LAC': 'LAC', 'LAR': 'LAR', 'LV': 'LV', 'MIA': 'MIA',
  'MIN': 'MIN', 'NE': 'NE', 'NO': 'NO', 'NYG': 'NYG',
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA',
  'SF': 'SF', 'TB': 'TB', 'TEN': 'TEN', 'WAS': 'WAS',
  // ESPN sometimes uses different abbreviations
  'WSH': 'WAS',
  'JAC': 'JAX',
};

// Track unknown team abbreviations (for debugging)
const unknownTeams = new Set<string>();

/**
 * Normalize ESPN team abbreviation to our format.
 * Logs unknown abbreviations for debugging.
 */
function normalizeTeamAbbr(espnAbbr: string | undefined): NFLTeam | null {
  if (!espnAbbr) return null;
  const upper = espnAbbr.toUpperCase();
  const normalized = ESPN_TEAM_MAP[upper];
  if (!normalized && !unknownTeams.has(upper)) {
    unknownTeams.add(upper);
    console.warn(`[ESPN] Unknown team abbreviation: "${espnAbbr}" - add to ESPN_TEAM_MAP if valid`);
  }
  return normalized ?? null;
}

/**
 * Parse FG distance from various ESPN text formats.
 * Tries multiple patterns to handle format changes.
 */
function parseFGDistance(playText: string): number | null {
  if (!playText) return null;

  // Pattern 1: "Name 50 Yd Field Goal" (standard)
  let match = playText.match(/(\d+)\s+Yd\s+Field\s+Goal/i);
  if (match) return parseInt(match[1], 10);

  // Pattern 2: "Name 50-yard field goal" (alternative)
  match = playText.match(/(\d+)-yard\s+field\s+goal/i);
  if (match) return parseInt(match[1], 10);

  // Pattern 3: "FG 50" or "50 FG"
  match = playText.match(/(?:FG\s+(\d+)|(\d+)\s+FG)/i);
  if (match) return parseInt(match[1] || match[2], 10);

  // Pattern 4: Just extract any number between 20-60 (typical FG range)
  match = playText.match(/\b([2-5][0-9])\b/);
  if (match) {
    const dist = parseInt(match[1], 10);
    if (dist >= 20 && dist <= 60) return dist;
  }

  // Log unparseable FG for debugging
  console.warn(`[ESPN] Could not parse FG distance from: "${playText}"`);
  return null;
}

/**
 * Fetch with retry and exponential backoff.
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;

      // Don't retry 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
      }

      // Retry 5xx errors (server errors)
      lastError = new Error(`ESPN API error: ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries - 1) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ESPN] Retry ${attempt + 1}/${retries} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('ESPN API request failed');
}

// Types for ESPN API responses
export interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  status: {
    type: {
      state: 'pre' | 'in' | 'post';
      completed: boolean;
      description: string;
    };
    period: number;
    displayClock: string;
  };
  competitions: ESPNCompetition[];
}

interface ESPNCompetition {
  id: string;
  competitors: ESPNCompetitor[];
  situation?: {
    possession: string;
    downDistanceText: string;
  };
}

interface ESPNCompetitor {
  id: string;
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
  score: string;
  homeAway: 'home' | 'away';
}

export interface ESPNPlayerStats {
  espnId: string;
  name: string;
  team: NFLTeam;
  position: string;
  headshot?: string;
  stats: Partial<PlayerStats>;
  fantasyPoints?: number;
}

export interface ESPNKickerStats {
  espnId: string;
  name: string;
  team: NFLTeam;
  headshot?: string;
  fg0_39: number;
  fg40_49: number;
  fg50Plus: number;
  fgMissed: number;
  xpMade: number;
  xpMissed: number;
  fgAttempts: number;
  fgMade: number;
  longFG: number;
}

export interface ESPNBoxScore {
  gameId: string;
  gameName: string;
  status: string;
  isComplete: boolean;
  isInProgress: boolean;
  homeTeam: NFLTeam;
  awayTeam: NFLTeam;
  homeScore: number;
  awayScore: number;
  players: ESPNPlayerStats[];
  kickerStats: ESPNKickerStats[];
  defenseStats: {
    team: NFLTeam;
    pointsAllowed: number;
    sacks: number;
    interceptions: number;
    fumbleRecoveries: number;
    defensiveTDs: number;
  }[];
}

// Playoff week date ranges are now imported from config/season.ts
// Use ESPN_PLAYOFF_DATE_RANGES for date filtering

/**
 * Fetch current NFL scoreboard (all games for today/this week).
 * Uses retry logic for resilience.
 */
export async function fetchNFLScoreboard(playoffWeek?: number): Promise<ESPNGame[]> {
  try {
    let url = `${ESPN_BASE_URL}/scoreboard`;

    // If playoff week specified, add date range parameter
    if (playoffWeek && ESPN_PLAYOFF_DATE_RANGES[playoffWeek]) {
      url += `?dates=${ESPN_PLAYOFF_DATE_RANGES[playoffWeek]}`;
    }

    const response = await fetchWithRetry(url);
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('[ESPN] Error fetching NFL scoreboard:', error);
    throw error;
  }
}

/**
 * Fetch detailed box score for a specific game.
 * Uses retry logic and returns null on failure (graceful degradation).
 */
export async function fetchGameBoxScore(gameId: string): Promise<ESPNBoxScore | null> {
  try {
    const response = await fetchWithRetry(`${ESPN_BASE_URL}/summary?event=${gameId}`);
    const data = await response.json();
    return parseBoxScore(gameId, data);
  } catch (error) {
    console.error(`[ESPN] Error fetching box score for game ${gameId}:`, error);
    return null;
  }
}

/**
 * Parse ESPN box score response into our format.
 * Uses graceful degradation for missing/malformed data.
 */
function parseBoxScore(gameId: string, data: any): ESPNBoxScore {
  const competition = data.header?.competitions?.[0];
  const boxscore = data.boxscore;
  const scoringPlays = data.scoringPlays || [];

  // Get team info with normalization
  const competitors = competition?.competitors || [];
  const homeTeamData = competitors.find((c: any) => c.homeAway === 'home');
  const awayTeamData = competitors.find((c: any) => c.homeAway === 'away');

  const homeAbbr = normalizeTeamAbbr(homeTeamData?.team?.abbreviation) || homeTeamData?.team?.abbreviation;
  const awayAbbr = normalizeTeamAbbr(awayTeamData?.team?.abbreviation) || awayTeamData?.team?.abbreviation;

  const status = competition?.status?.type;

  // Parse FG distances from scoring plays using robust parser
  const fgDistances: { kickerName: string; team: string; distance: number }[] = [];
  for (const play of scoringPlays) {
    if (play.scoringType?.name === 'field-goal' && play.text) {
      const distance = parseFGDistance(play.text);
      if (distance !== null) {
        // Extract kicker name (everything before the distance)
        const nameMatch = play.text.match(/^(.+?)\s+\d+/);
        const kickerName = nameMatch ? nameMatch[1].trim() : 'Unknown';
        const teamAbbr = normalizeTeamAbbr(play.team?.abbreviation) || play.team?.abbreviation;
        fgDistances.push({
          kickerName,
          team: teamAbbr,
          distance,
        });
      }
    }
  }

  // Parse player stats from box score
  const players: ESPNPlayerStats[] = [];
  const kickerStats: ESPNKickerStats[] = [];
  const defenseStats: ESPNBoxScore['defenseStats'] = [];

  // Process each team's player stats
  for (const teamStats of boxscore?.players || []) {
    const teamAbbr = normalizeTeamAbbr(teamStats.team?.abbreviation) || teamStats.team?.abbreviation;

    // Each team has multiple stat categories (passing, rushing, receiving, etc.)
    for (const category of teamStats.statistics || []) {
      const categoryName = category.name;
      const keys = category.keys || [];

      // Handle kicking stats separately for better FG distance tracking
      if (categoryName.toLowerCase() === 'kicking') {
        for (const athlete of category.athletes || []) {
          const athleteInfo = athlete.athlete;
          const stats = athlete.stats || [];

          // Parse FG made/attempted from box score
          // Format: "2/2" for fieldGoalsMade/fieldGoalAttempts
          const fgIdx = keys.indexOf('fieldGoalsMade/fieldGoalAttempts');
          const fgStr = fgIdx >= 0 ? stats[fgIdx] : '0/0';
          const [fgMadeStr, fgAttStr] = fgStr.split('/');
          const fgMade = parseInt(fgMadeStr) || 0;
          const fgAttempts = parseInt(fgAttStr) || 0;

          // Parse XP made/attempted
          const xpIdx = keys.indexOf('extraPointsMade/extraPointAttempts');
          const xpStr = xpIdx >= 0 ? stats[xpIdx] : '0/0';
          const [xpMadeStr, xpAttStr] = xpStr.split('/');
          const xpMade = parseInt(xpMadeStr) || 0;
          const xpAttempts = parseInt(xpAttStr) || 0;

          // Parse longest FG
          const longIdx = keys.indexOf('longFieldGoalMade');
          const longFG = longIdx >= 0 ? parseInt(stats[longIdx]) || 0 : 0;

          // Get FG distances for this kicker from scoring plays
          const kickerFGs = fgDistances.filter(
            fg => fg.kickerName.toLowerCase() === athleteInfo.displayName.toLowerCase() ||
                  fg.kickerName.toLowerCase().includes(athleteInfo.lastName?.toLowerCase() || '')
          );

          // Categorize FGs by distance
          let fg0_39 = 0;
          let fg40_49 = 0;
          let fg50Plus = 0;

          for (const fg of kickerFGs) {
            if (fg.distance >= 50) {
              fg50Plus++;
            } else if (fg.distance >= 40) {
              fg40_49++;
            } else {
              fg0_39++;
            }
          }

          // If we found fewer FGs in scoring plays than box score shows, distribute remainder to 0-39
          const foundFGs = fg0_39 + fg40_49 + fg50Plus;
          if (foundFGs < fgMade) {
            fg0_39 += fgMade - foundFGs;
          }

          kickerStats.push({
            espnId: athleteInfo.id,
            name: athleteInfo.displayName,
            team: teamAbbr as NFLTeam,
            headshot: athleteInfo.headshot?.href,
            fg0_39,
            fg40_49,
            fg50Plus,
            fgMissed: fgAttempts - fgMade,
            xpMade,
            xpMissed: xpAttempts - xpMade,
            fgAttempts,
            fgMade,
            longFG,
          });
        }
        continue; // Skip normal player processing for kickers
      }

      for (const athlete of category.athletes || []) {
        const athleteInfo = athlete.athlete;
        const stats = athlete.stats || [];

        // Find or create player entry
        let playerEntry = players.find(p => p.espnId === athleteInfo.id);
        if (!playerEntry) {
          playerEntry = {
            espnId: athleteInfo.id,
            name: athleteInfo.displayName,
            team: teamAbbr as NFLTeam,
            position: athleteInfo.position?.abbreviation || '',
            headshot: athleteInfo.headshot?.href,
            stats: {
              playerId: '', // Will be matched later
              week: 0,
              passingYards: 0,
              passingTDs: 0,
              interceptions: 0,
              rushingYards: 0,
              rushingTDs: 0,
              receptions: 0,
              receivingYards: 0,
              receivingTDs: 0,
              fg0_39: 0,
              fg40_49: 0,
              fg50Plus: 0,
              fgMissed: 0,
              xpMade: 0,
              xpMissed: 0,
              pointsAllowed: 0,
              sacks: 0,
              defensiveInterceptions: 0,
              fumbleRecoveries: 0,
              defensiveTDs: 0,
            },
          };
          players.push(playerEntry);
        }

        // Map stats based on category
        parsePlayerCategoryStats(playerEntry, categoryName, keys, stats);
      }
    }
  }

  // Parse team defense stats
  // First pass: collect each team's offensive stats that need to be swapped
  // (INTs thrown, fumbles lost, times sacked)
  const teamOffensiveStats: Record<string, { intsThrown: number; fumblesLost: number; timesSacked: number }> = {};

  for (const teamStats of boxscore?.teams || []) {
    const teamAbbr = normalizeTeamAbbr(teamStats.team?.abbreviation) || teamStats.team?.abbreviation;
    teamOffensiveStats[teamAbbr] = { intsThrown: 0, fumblesLost: 0, timesSacked: 0 };

    for (const stat of teamStats.statistics || []) {
      const label = stat.label?.toLowerCase() || stat.name?.toLowerCase() || '';
      const displayValue = stat.displayValue || '';

      // These are offensive stats (turnovers/sacks allowed by this team)
      if (label.includes('interceptions thrown')) {
        teamOffensiveStats[teamAbbr].intsThrown = parseFloat(displayValue) || 0;
      } else if (label.includes('fumbles lost')) {
        teamOffensiveStats[teamAbbr].fumblesLost = parseFloat(displayValue) || 0;
      } else if (label.includes('sacks-yards lost') || label === 'sacks-yards lost') {
        // Format: "2-14" means 2 sacks for 14 yards lost
        const sackMatch = displayValue.match(/^(\d+)-/);
        if (sackMatch) {
          teamOffensiveStats[teamAbbr].timesSacked = parseInt(sackMatch[1]) || 0;
        }
      }
    }
  }

  // Second pass: build defense stats using opponent's offensive stats
  for (const teamStats of boxscore?.teams || []) {
    const teamAbbr = normalizeTeamAbbr(teamStats.team?.abbreviation) || teamStats.team?.abbreviation;
    const opponentAbbr = teamAbbr === homeAbbr ? awayAbbr : homeAbbr;
    const opponentScore = teamAbbr === homeAbbr
      ? parseInt(awayTeamData?.score || '0')
      : parseInt(homeTeamData?.score || '0');

    // Get opponent's offensive stats (which become this team's defensive stats)
    const opponentStats = teamOffensiveStats[opponentAbbr] || { intsThrown: 0, fumblesLost: 0, timesSacked: 0 };

    const teamDefense = {
      team: teamAbbr as NFLTeam,
      pointsAllowed: opponentScore,
      sacks: opponentStats.timesSacked, // Sacks we recorded = times opponent was sacked
      interceptions: opponentStats.intsThrown, // INTs we caught = INTs opponent threw
      fumbleRecoveries: opponentStats.fumblesLost, // Fumbles we recovered = fumbles opponent lost
      defensiveTDs: 0,
    };

    // Parse defensive TDs (this is a direct stat, not swapped)
    for (const stat of teamStats.statistics || []) {
      const label = stat.label?.toLowerCase() || stat.name?.toLowerCase() || '';
      const value = parseFloat(stat.displayValue) || 0;

      if (label.includes('defensive') && label.includes('td')) {
        teamDefense.defensiveTDs = value;
      }
    }

    defenseStats.push(teamDefense);
  }

  return {
    gameId,
    gameName: `${awayAbbr} @ ${homeAbbr}`,
    status: status?.description || 'Unknown',
    isComplete: status?.completed || false,
    isInProgress: status?.state === 'in',
    homeTeam: homeAbbr as NFLTeam,
    awayTeam: awayAbbr as NFLTeam,
    homeScore: parseInt(homeTeamData?.score || '0'),
    awayScore: parseInt(awayTeamData?.score || '0'),
    players,
    kickerStats,
    defenseStats,
  };
}

// Parse stats for a specific category
function parsePlayerCategoryStats(
  player: ESPNPlayerStats,
  category: string,
  keys: string[],
  stats: string[]
) {
  const getStatValue = (key: string): number => {
    const idx = keys.indexOf(key);
    if (idx === -1) return 0;
    const val = stats[idx];
    if (!val) return 0;
    // Handle "completions/attempts" format
    if (val.includes('/')) return 0;
    return parseFloat(val) || 0;
  };

  const getStatFromPattern = (pattern: RegExp): number => {
    for (let i = 0; i < keys.length; i++) {
      if (pattern.test(keys[i].toLowerCase())) {
        const val = stats[i];
        if (val && !val.includes('/')) {
          return parseFloat(val) || 0;
        }
      }
    }
    return 0;
  };

  switch (category.toLowerCase()) {
    case 'passing':
      player.stats.passingYards = getStatValue('passingYards') || getStatFromPattern(/yards?$/);
      player.stats.passingTDs = getStatValue('passingTouchdowns') || getStatFromPattern(/touchdown/);
      player.stats.interceptions = getStatValue('interceptions') || getStatFromPattern(/interception/);
      break;

    case 'rushing':
      player.stats.rushingYards = getStatValue('rushingYards') || getStatFromPattern(/yards?$/);
      player.stats.rushingTDs = getStatValue('rushingTouchdowns') || getStatFromPattern(/touchdown/);
      break;

    case 'receiving':
      player.stats.receptions = getStatValue('receptions') || getStatFromPattern(/reception/);
      player.stats.receivingYards = getStatValue('receivingYards') || getStatFromPattern(/yards?$/);
      player.stats.receivingTDs = getStatValue('receivingTouchdowns') || getStatFromPattern(/touchdown/);
      break;

    case 'kicking':
      // Parse field goals - ESPN format varies
      const fgMadeStr = stats[keys.indexOf('fieldGoalsMade')] || stats[keys.indexOf('FGM')] || '0';
      const fgAttStr = stats[keys.indexOf('fieldGoalsAttempted')] || stats[keys.indexOf('FGA')] || '0';
      const fgMade = parseInt(fgMadeStr) || 0;
      const fgAtt = parseInt(fgAttStr) || 0;
      // Default all FGs to 0-39 range (we'd need more detailed data for distance breakdown)
      player.stats.fg0_39 = fgMade;
      player.stats.fgMissed = fgAtt - fgMade;

      const xpMadeStr = stats[keys.indexOf('extraPointsMade')] || stats[keys.indexOf('XPM')] || '0';
      const xpAttStr = stats[keys.indexOf('extraPointsAttempted')] || stats[keys.indexOf('XPA')] || '0';
      player.stats.xpMade = parseInt(xpMadeStr) || 0;
      player.stats.xpMissed = (parseInt(xpAttStr) || 0) - (parseInt(xpMadeStr) || 0);
      break;
  }
}

// Fetch all live game stats and combine them
export async function fetchAllLiveStats(): Promise<ESPNBoxScore[]> {
  const games = await fetchNFLScoreboard();
  const boxScores: ESPNBoxScore[] = [];

  for (const game of games) {
    const status = game.status?.type?.state;
    // Only fetch details for games in progress or completed
    if (status === 'in' || status === 'post') {
      const boxScore = await fetchGameBoxScore(game.id);
      if (boxScore) {
        boxScores.push(boxScore);
      }
    }
  }

  return boxScores;
}

// Match ESPN player to our player by name and team
export function matchPlayer(
  espnPlayer: ESPNPlayerStats,
  ourPlayers: { id: string; name: string; team: string }[]
): string | null {
  // Normalize names for comparison (removes suffixes like Jr., Sr., III, II)
  const normalize = (name: string) =>
    name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+(jr|sr|iii|ii|iv|v)(\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const espnName = normalize(espnPlayer.name);
  const espnTeam = espnPlayer.team;

  // Try exact match first (after normalization removes suffixes)
  for (const player of ourPlayers) {
    if (normalize(player.name) === espnName && player.team === espnTeam) {
      return player.id;
    }
  }

  // Try first name + last name match (handles suffix differences like Jr./Sr.)
  const espnParts = espnName.split(' ');
  const espnFirstName = espnParts[0] || '';
  const espnLastName = espnParts[espnParts.length - 1] || '';

  for (const player of ourPlayers) {
    const ourParts = normalize(player.name).split(' ');
    const ourFirstName = ourParts[0] || '';
    const ourLastName = ourParts[ourParts.length - 1] || '';

    // Match if first name AND last name match AND same team
    if (ourFirstName === espnFirstName && ourLastName === espnLastName && player.team === espnTeam) {
      return player.id;
    }
  }

  // Try last name + team match as fallback
  for (const player of ourPlayers) {
    const ourLastName = normalize(player.name).split(' ').pop() || '';
    if (ourLastName === espnLastName && player.team === espnTeam) {
      return player.id;
    }
  }

  // Try fuzzy match (same team, similar name)
  for (const player of ourPlayers) {
    if (player.team === espnTeam) {
      const ourName = normalize(player.name);
      // Check if names share significant overlap
      if (espnName.includes(ourName) || ourName.includes(espnName)) {
        return player.id;
      }
    }
  }

  return null;
}

// Convert ESPN stats to our PlayerStats format
export function toPlayerStats(
  espnPlayer: ESPNPlayerStats,
  playerId: string,
  weekNumber: number
): PlayerStats {
  return {
    playerId,
    week: weekNumber,
    passingYards: espnPlayer.stats.passingYards || 0,
    passingTDs: espnPlayer.stats.passingTDs || 0,
    interceptions: espnPlayer.stats.interceptions || 0,
    rushingYards: espnPlayer.stats.rushingYards || 0,
    rushingTDs: espnPlayer.stats.rushingTDs || 0,
    receptions: espnPlayer.stats.receptions || 0,
    receivingYards: espnPlayer.stats.receivingYards || 0,
    receivingTDs: espnPlayer.stats.receivingTDs || 0,
    fg0_39: espnPlayer.stats.fg0_39 || 0,
    fg40_49: espnPlayer.stats.fg40_49 || 0,
    fg50Plus: espnPlayer.stats.fg50Plus || 0,
    fgMissed: espnPlayer.stats.fgMissed || 0,
    xpMade: espnPlayer.stats.xpMade || 0,
    xpMissed: espnPlayer.stats.xpMissed || 0,
    pointsAllowed: 0,
    sacks: 0,
    defensiveInterceptions: 0,
    fumbleRecoveries: 0,
    defensiveTDs: 0,
  };
}

// Create defense PlayerStats from team defense data
export function toDefenseStats(
  defense: ESPNBoxScore['defenseStats'][0],
  playerId: string,
  weekNumber: number
): PlayerStats {
  return {
    playerId,
    week: weekNumber,
    passingYards: 0,
    passingTDs: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    fg0_39: 0,
    fg40_49: 0,
    fg50Plus: 0,
    fgMissed: 0,
    xpMade: 0,
    xpMissed: 0,
    pointsAllowed: defense.pointsAllowed,
    sacks: defense.sacks,
    defensiveInterceptions: defense.interceptions,
    fumbleRecoveries: defense.fumbleRecoveries,
    defensiveTDs: defense.defensiveTDs,
  };
}

// Create kicker PlayerStats from ESPNKickerStats
export function toKickerStats(
  kicker: ESPNKickerStats,
  playerId: string,
  weekNumber: number
): PlayerStats {
  return {
    playerId,
    week: weekNumber,
    passingYards: 0,
    passingTDs: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    fg0_39: kicker.fg0_39,
    fg40_49: kicker.fg40_49,
    fg50Plus: kicker.fg50Plus,
    fgMissed: kicker.fgMissed,
    xpMade: kicker.xpMade,
    xpMissed: kicker.xpMissed,
    pointsAllowed: 0,
    sacks: 0,
    defensiveInterceptions: 0,
    fumbleRecoveries: 0,
    defensiveTDs: 0,
  };
}
