import type { Player, NFLTeam, Position, PlayerStats, InjuryStatus } from '../types';

// ESPN API endpoints (unofficial)
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// Team ID mapping for ESPN
const ESPN_TEAM_IDS: Record<NFLTeam, string> = {
  ARI: '22', ATL: '1', BAL: '33', BUF: '2', CAR: '29', CHI: '3', CIN: '4', CLE: '5',
  DAL: '6', DEN: '7', DET: '8', GB: '9', HOU: '34', IND: '11', JAX: '30', KC: '12',
  LAC: '24', LAR: '14', LV: '13', MIA: '15', MIN: '16', NE: '17', NO: '18', NYG: '19',
  NYJ: '20', PHI: '21', PIT: '23', SEA: '26', SF: '25', TB: '27', TEN: '10', WAS: '28',
};

// Reverse mapping
const ESPN_ID_TO_TEAM: Record<string, NFLTeam> = Object.fromEntries(
  Object.entries(ESPN_TEAM_IDS).map(([team, id]) => [id, team as NFLTeam])
) as Record<string, NFLTeam>;

// Position mapping from ESPN position IDs
const ESPN_POSITION_MAP: Record<string, Position> = {
  '1': 'QB',
  '2': 'RB',
  '3': 'WR',
  '4': 'TE',
  '5': 'K',
  '16': 'DST',
};

// 2024-2025 Playoff teams (update this each year)
export const PLAYOFF_TEAMS_2024: NFLTeam[] = [
  'KC', 'BUF', 'BAL', 'HOU', 'LAC', 'PIT', 'DEN',  // AFC
  'DET', 'PHI', 'TB', 'LAR', 'MIN', 'WAS', 'GB',   // NFC
];

// Get teams playing in a specific playoff week
export function getPlayoffTeamsForWeek(_week: number): NFLTeam[] {
  // Week 1: Wild Card (12 teams), Week 2: Divisional (8 teams),
  // Week 3: Conference (4 teams), Week 4: Super Bowl (2 teams)
  // For simplicity, return all playoff teams - in production, filter by schedule
  return PLAYOFF_TEAMS_2024;
}

// Fetch team roster from ESPN
async function fetchTeamRoster(teamId: string): Promise<Player[]> {
  try {
    const response = await fetch(
      `${ESPN_BASE_URL}/teams/${teamId}/roster`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch roster: ${response.status}`);
    }

    const data = await response.json();
    const players: Player[] = [];

    // Parse athletes from the response
    if (data.athletes) {
      for (const group of data.athletes) {
        for (const athlete of group.items || []) {
          const positionId = athlete.position?.id;
          const position = ESPN_POSITION_MAP[positionId];

          // Only include fantasy-relevant positions
          if (position) {
            players.push({
              id: athlete.id,
              name: athlete.fullName || athlete.displayName,
              team: ESPN_ID_TO_TEAM[teamId],
              position,
              imageUrl: athlete.headshot?.href,
            });
          }
        }
      }
    }

    return players;
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return [];
  }
}

// Fetch all playoff team rosters
export async function fetchPlayoffPlayers(week: number = 1): Promise<Player[]> {
  const playoffTeams = getPlayoffTeamsForWeek(week);
  const allPlayers: Player[] = [];

  // Add D/ST entries for each team
  for (const team of playoffTeams) {
    allPlayers.push({
      id: `DST-${team}`,
      name: `${team} Defense`,
      team,
      position: 'DST',
    });
  }

  // Fetch player rosters for each team
  for (const team of playoffTeams) {
    const teamId = ESPN_TEAM_IDS[team];
    const players = await fetchTeamRoster(teamId);
    allPlayers.push(...players);
  }

  return allPlayers;
}

// Fetch player stats (for scoring)
export async function fetchPlayerStats(playerId: string, week: number): Promise<PlayerStats | null> {
  try {
    // ESPN's stats endpoint is complex - using scoreboard for game stats
    // In a production app, you'd want a more robust stats source
    const response = await fetch(
      `${ESPN_BASE_URL}/athletes/${playerId}/statistics`
    );

    if (!response.ok) {
      return null;
    }

    await response.json();

    // Parse stats from response - this is simplified
    // Real implementation would need to parse the specific stat categories
    // TODO: Parse actual stats from ESPN response
    return {
      playerId,
      week,
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
    };
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return null;
  }
}

// Get current playoff week based on date
export function getCurrentPlayoffWeek(): number {
  const now = new Date();
  const year = now.getFullYear();

  // Approximate playoff dates (adjust each year)
  const wildCardStart = new Date(year, 0, 11); // January 11
  const divisionalStart = new Date(year, 0, 18); // January 18
  const conferenceStart = new Date(year, 0, 26); // January 26
  const superBowlStart = new Date(year, 1, 9); // February 9

  if (now >= superBowlStart) return 4;
  if (now >= conferenceStart) return 3;
  if (now >= divisionalStart) return 2;
  if (now >= wildCardStart) return 1;

  return 1; // Default to week 1
}

// Get playoff week name
export function getPlayoffWeekName(week: number): string {
  switch (week) {
    case 1: return 'Wild Card Round';
    case 2: return 'Divisional Round';
    case 3: return 'Conference Championships';
    case 4: return 'Super Bowl';
    default: return `Week ${week}`;
  }
}

// Fetch all players from specific teams to build a lookup map
export async function fetchESPNPlayersForTeams(teams: NFLTeam[]): Promise<Map<string, { espnId: string; imageUrl?: string }>> {
  const playerMap = new Map<string, { espnId: string; imageUrl?: string }>();

  for (const team of teams) {
    const teamId = ESPN_TEAM_IDS[team];
    if (!teamId) continue;

    try {
      const response = await fetch(`${ESPN_BASE_URL}/teams/${teamId}/roster`);
      if (!response.ok) continue;

      const data = await response.json();

      if (data.athletes) {
        for (const group of data.athletes) {
          for (const athlete of group.items || []) {
            const name = (athlete.fullName || athlete.displayName || '').toLowerCase().trim();
            if (name) {
              playerMap.set(name, {
                espnId: athlete.id,
                imageUrl: athlete.headshot?.href,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching ESPN roster for ${team}:`, error);
    }
  }

  return playerMap;
}

// ESPN injury status mapping to our InjuryStatus type
function mapESPNInjuryStatus(espnStatus: string): InjuryStatus | null {
  switch (espnStatus.toLowerCase()) {
    case 'out':
    case 'injured reserve':
    case 'ir':
      return 'out';
    case 'questionable':
    case 'doubtful':
      return 'questionable';
    default:
      return null; // Active, Day-To-Day, etc. - no injury designation
  }
}

// Injury data from ESPN
export interface ESPNInjury {
  playerName: string;
  playerId: string;
  team: NFLTeam;
  status: InjuryStatus;
  espnStatus: string;
  comment?: string;
}

// Fetch all NFL injuries from ESPN
export async function fetchESPNInjuries(): Promise<ESPNInjury[]> {
  const injuries: ESPNInjury[] = [];

  try {
    const response = await fetch(`${ESPN_BASE_URL}/injuries`);
    if (!response.ok) {
      throw new Error(`Failed to fetch injuries: ${response.status}`);
    }

    const data = await response.json();

    for (const teamData of data.injuries || []) {
      // Get team abbreviation from team ID
      const teamId = teamData.id;
      const team = ESPN_ID_TO_TEAM[teamId];
      if (!team) continue;

      for (const injury of teamData.injuries || []) {
        const espnStatus = injury.status || '';
        const mappedStatus = mapESPNInjuryStatus(espnStatus);

        // Only include players with actual injury designations
        if (mappedStatus) {
          const athlete = injury.athlete || {};
          injuries.push({
            playerName: athlete.displayName || '',
            playerId: athlete.id || '',
            team,
            status: mappedStatus,
            espnStatus,
            comment: injury.shortComment,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching ESPN injuries:', error);
  }

  return injuries;
}

// Fetch injuries for specific teams only
export async function fetchESPNInjuriesForTeams(teams: NFLTeam[]): Promise<ESPNInjury[]> {
  const allInjuries = await fetchESPNInjuries();
  const teamSet = new Set(teams);
  return allInjuries.filter(inj => teamSet.has(inj.team));
}
