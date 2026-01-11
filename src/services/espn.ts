// ESPN API Service for fetching live NFL stats
// Note: This is an unofficial API - no auth required but could change without notice

import type { PlayerStats, NFLTeam } from '../types';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// ESPN team abbreviation mapping to our format
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
  defenseStats: {
    team: NFLTeam;
    pointsAllowed: number;
    sacks: number;
    interceptions: number;
    fumbleRecoveries: number;
    defensiveTDs: number;
  }[];
}

// Fetch current NFL scoreboard (all games for today/this week)
export async function fetchNFLScoreboard(): Promise<ESPNGame[]> {
  try {
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard`);
    if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching NFL scoreboard:', error);
    throw error;
  }
}

// Fetch detailed box score for a specific game
export async function fetchGameBoxScore(gameId: string): Promise<ESPNBoxScore | null> {
  try {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`);
    if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);

    const data = await response.json();
    return parseBoxScore(gameId, data);
  } catch (error) {
    console.error(`Error fetching box score for game ${gameId}:`, error);
    return null;
  }
}

// Parse ESPN box score response into our format
function parseBoxScore(gameId: string, data: any): ESPNBoxScore {
  const competition = data.header?.competitions?.[0];
  const boxscore = data.boxscore;

  // Get team info
  const competitors = competition?.competitors || [];
  const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
  const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

  const homeAbbr = ESPN_TEAM_MAP[homeTeam?.team?.abbreviation] || homeTeam?.team?.abbreviation;
  const awayAbbr = ESPN_TEAM_MAP[awayTeam?.team?.abbreviation] || awayTeam?.team?.abbreviation;

  const status = competition?.status?.type;

  // Parse player stats from box score
  const players: ESPNPlayerStats[] = [];
  const defenseStats: ESPNBoxScore['defenseStats'] = [];

  // Process each team's player stats
  for (const teamStats of boxscore?.players || []) {
    const teamAbbr = ESPN_TEAM_MAP[teamStats.team?.abbreviation] || teamStats.team?.abbreviation;

    // Each team has multiple stat categories (passing, rushing, receiving, etc.)
    for (const category of teamStats.statistics || []) {
      const categoryName = category.name;
      const keys = category.keys || [];

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
  for (const teamStats of boxscore?.teams || []) {
    const teamAbbr = ESPN_TEAM_MAP[teamStats.team?.abbreviation] || teamStats.team?.abbreviation;
    const opponentScore = teamAbbr === homeAbbr
      ? parseInt(awayTeam?.score || '0')
      : parseInt(homeTeam?.score || '0');

    const teamDefense = {
      team: teamAbbr as NFLTeam,
      pointsAllowed: opponentScore,
      sacks: 0,
      interceptions: 0,
      fumbleRecoveries: 0,
      defensiveTDs: 0,
    };

    // Parse team statistics for defensive stats
    for (const stat of teamStats.statistics || []) {
      const label = stat.label?.toLowerCase() || stat.name?.toLowerCase() || '';
      const value = parseFloat(stat.displayValue) || 0;

      if (label.includes('sack') && !label.includes('allowed')) {
        teamDefense.sacks = value;
      } else if (label.includes('interception') || label === 'int') {
        teamDefense.interceptions = value;
      } else if (label.includes('fumble') && label.includes('rec')) {
        teamDefense.fumbleRecoveries = value;
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
    homeScore: parseInt(homeTeam?.score || '0'),
    awayScore: parseInt(awayTeam?.score || '0'),
    players,
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
  // Normalize names for comparison
  const normalize = (name: string) =>
    name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const espnName = normalize(espnPlayer.name);
  const espnTeam = espnPlayer.team;

  // Try exact match first
  for (const player of ourPlayers) {
    if (normalize(player.name) === espnName && player.team === espnTeam) {
      return player.id;
    }
  }

  // Try partial match (last name + team)
  const espnLastName = espnName.split(' ').pop() || '';
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
