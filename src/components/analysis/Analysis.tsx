import { useState, useEffect, useMemo } from 'react';
import { getAllRostersForWeek, getCachedPlayers, getAllPlayerStatsForWeek, getAllUsers } from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';
import type { Player, WeeklyRoster, Position, PlayoffWeekName, PlayerStats, User } from '../../types';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const WEEKS: { week: number; name: PlayoffWeekName }[] = [
  { week: 1, name: 'wildcard' },
  { week: 2, name: 'divisional' },
  { week: 3, name: 'championship' },
];

// Stats weeks that have completed
const STATS_WEEKS: { week: number; name: PlayoffWeekName; label: string }[] = [
  { week: 1, name: 'wildcard', label: 'Wild Card' },
  { week: 2, name: 'divisional', label: 'Divisional' },
  { week: 3, name: 'championship', label: 'Championship' },
];

// Teams eliminated after Wild Card round (lost their game)
// Divisional teams are: BUF, DEN, NE, HOU, CHI, LAR, SEA, SF
const ELIMINATED_TEAMS_AFTER_WILDCARD = new Set(['PIT', 'LAC', 'TB', 'GB', 'MIN', 'WAS', 'CAR', 'JAX', 'PHI']);

// Teams eliminated after Divisional round (not in championship)
// Championship teams are: SEA, LAR, DEN, NE
const ELIMINATED_TEAMS_AFTER_DIVISIONAL = new Set(['BUF', 'CHI', 'SF', 'HOU']);

// Teams eliminated after Championship round (not in Super Bowl)
// Super Bowl teams are: SEA, NE
const ELIMINATED_TEAMS_AFTER_CHAMPIONSHIP = new Set(['DEN', 'LAR']);

// Roster slots in order
const ROSTER_SLOTS = ['qb', 'rb1', 'rb2', 'wr1', 'wr2', 'wr3', 'te', 'dst', 'k'] as const;
const SLOT_LABELS: Record<string, string> = {
  qb: 'QB', rb1: 'RB1', rb2: 'RB2', wr1: 'WR1', wr2: 'WR2', wr3: 'WR3', te: 'TE', dst: 'DST', k: 'K'
};

interface PlayerCount {
  player: Player;
  count: number;
}

interface PlayerScore {
  player: Player;
  points: number;
}

interface TopScorersChartProps {
  position: Position;
  playerScores: PlayerScore[];
  maxPoints: number;
  eliminatedTeams: Set<string>;
  availableLabel: string;
}

function TopScorersChart({ position, playerScores, maxPoints, eliminatedTeams, availableLabel }: TopScorersChartProps) {
  if (playerScores.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500 text-sm text-center">No stats available for {position}</p>
      </div>
    );
  }

  const chartHeight = 350;
  const chartPadding = 80; // Bottom padding for labels

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="relative" style={{ height: chartHeight + chartPadding }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 w-12 flex flex-col justify-between text-sm text-gray-500 font-medium" style={{ height: chartHeight }}>
          <span>{maxPoints.toFixed(0)} pts</span>
          <span>{(maxPoints * 0.75).toFixed(0)}</span>
          <span>{(maxPoints * 0.5).toFixed(0)}</span>
          <span>{(maxPoints * 0.25).toFixed(0)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 relative" style={{ height: chartHeight + chartPadding }}>
          {/* Grid lines */}
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: chartHeight }}>
            <div className="border-b border-gray-200 w-full" />
            <div className="border-b border-gray-100 w-full" />
            <div className="border-b border-gray-100 w-full" />
            <div className="border-b border-gray-100 w-full" />
            <div className="border-b border-gray-300 w-full" />
          </div>

          {/* Data points */}
          <div className="relative flex justify-around" style={{ height: chartHeight }}>
            {playerScores.slice(0, 10).map(({ player, points }) => {
              const heightPercent = (points / maxPoints) * 100;
              const isEliminated = eliminatedTeams.has(player.team);
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center relative"
                  style={{ width: '10%' }}
                >
                  {/* Player image as data point */}
                  <div
                    className="absolute transition-all duration-300"
                    style={{
                      bottom: `${heightPercent}%`,
                      transform: 'translateY(50%)'
                    }}
                  >
                    <div className="relative group cursor-pointer">
                      {player.imageUrl ? (
                        <img
                          src={player.imageUrl}
                          alt={player.name}
                          className={`w-12 h-12 rounded-full border-3 shadow-lg object-cover hover:scale-110 transition-transform ${
                            isEliminated
                              ? 'border-red-400 grayscale opacity-70'
                              : 'border-green-400'
                          }`}
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full border-3 shadow-lg flex items-center justify-center text-sm font-bold hover:scale-110 transition-transform ${
                          isEliminated
                            ? 'border-red-400 bg-gray-400 text-gray-600 opacity-70'
                            : 'border-green-400 bg-gray-300 text-gray-600'
                        }`}>
                          {player.name.charAt(0)}
                        </div>
                      )}
                      {/* Eliminated badge */}
                      {isEliminated && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                          ✗
                        </div>
                      )}
                      {/* Still available badge */}
                      {!isEliminated && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                          ✓
                        </div>
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                        <div className="font-semibold">{player.name}</div>
                        <div className="text-primary-300">{points.toFixed(1)} points</div>
                        <div className={isEliminated ? 'text-red-400' : 'text-green-400'}>
                          {isEliminated ? '❌ Eliminated' : `✅ Available for ${availableLabel}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Player name label */}
                  <div
                    className="absolute flex flex-col items-center"
                    style={{ top: chartHeight + 10 }}
                  >
                    <span className={`text-sm font-medium ${isEliminated ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {player.name.split(' ').pop()}
                    </span>
                    <span className={`text-xs ${isEliminated ? 'text-red-400' : 'text-gray-500'}`}>
                      {player.team}
                    </span>
                    <span className={`text-xs font-semibold ${isEliminated ? 'text-gray-400' : 'text-primary-600'}`}>
                      {points.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface WinningRostersProps {
  topRosters: {
    user: User;
    roster: WeeklyRoster;
    totalPoints: number;
    playerBreakdown: { slot: string; player: Player; points: number }[];
  }[];
  consensusPlayers: Set<string>; // Players picked by 3+ of top 5 rosters
  galaxyBrainPicks: { user: User; player: Player; points: number; selectionRate: number; positionRank: number }[];
}

function WinningRosters({ topRosters, consensusPlayers, galaxyBrainPicks }: WinningRostersProps) {
  const getBorderColor = (idx: number) => {
    switch (idx) {
      case 0: return 'border-yellow-400';
      case 1: return 'border-gray-400';
      case 2: return 'border-amber-600';
      default: return 'border-gray-200';
    }
  };

  const getBadgeColor = (idx: number) => {
    switch (idx) {
      case 0: return 'bg-yellow-500';
      case 1: return 'bg-gray-400';
      case 2: return 'bg-amber-600';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Rosters Side by Side */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {topRosters.map((entry, idx) => (
          <div
            key={entry.user.uid}
            className={`bg-white rounded-lg shadow-sm border-2 p-3 ${getBorderColor(idx)}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm ${getBadgeColor(idx)}`}>
                {idx + 1}
              </div>
              {entry.user.photoURL ? (
                <img src={entry.user.photoURL} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">
                  {entry.user.displayName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{entry.user.displayName}</div>
                <div className="text-xs font-medium text-primary-600">{entry.totalPoints.toFixed(1)} pts</div>
              </div>
            </div>

            {/* Roster */}
            <div className="space-y-2">
              {entry.playerBreakdown.map(({ slot, player, points }) => {
                const isConsensus = consensusPlayers.has(player.id);
                const isGalaxyBrain = galaxyBrainPicks.some(g => g.player.id === player.id && g.user.uid === entry.user.uid);
                return (
                  <div
                    key={slot}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      isGalaxyBrain
                        ? 'bg-purple-50 border border-purple-200'
                        : isConsensus
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-medium text-gray-500 w-8">{SLOT_LABELS[slot]}</span>
                    {player.imageUrl ? (
                      <img src={player.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold">
                        {player.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{player.name}</div>
                      <div className="text-xs text-gray-500">{player.team}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">{points.toFixed(1)}</div>
                    {isGalaxyBrain && (
                      <span className="text-purple-500" title="Galaxy Brain Pick">🧠</span>
                    )}
                    {isConsensus && !isGalaxyBrain && (
                      <span className="text-green-500" title="Consensus Pick">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Galaxy Brain Section */}
      {galaxyBrainPicks.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
          <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <span className="text-xl">🧠</span> Galaxy Brain Picks
            <span className="text-sm font-normal text-purple-600">(Top 5 at position, eliminated team, picked by &lt;30%)</span>
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galaxyBrainPicks.map(({ user, player, points, selectionRate, positionRank }) => (
              <div key={`${user.uid}-${player.id}`} className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
                <div className="relative">
                  {player.imageUrl ? (
                    <img src={player.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover grayscale border-2 border-red-300" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold border-2 border-red-300">
                      {player.name[0]}
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✗</div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{player.name}</div>
                  <div className="text-sm text-purple-600 font-semibold">#{positionRank} {player.position} • {points.toFixed(1)} pts</div>
                  <div className="text-xs text-gray-500">Only {(selectionRate * 100).toFixed(0)}% picked</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-purple-600 font-medium">picked by</div>
                  <div className="text-sm font-semibold text-gray-700">{user.displayName?.split(' ')[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-6 text-sm text-gray-600 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
          <span>Consensus pick (3+ of top 5)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300" />
          <span>Galaxy brain (top 5 at position, eliminated, rarely picked)</span>
        </div>
      </div>
    </div>
  );
}

interface PositionBarChartProps {
  position: Position;
  playerCounts: PlayerCount[];
  maxCount: number;
}

function PositionBarChart({ position, playerCounts, maxCount }: PositionBarChartProps) {
  if (playerCounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">{position}</h3>
        <p className="text-gray-500 text-sm">No selections yet</p>
      </div>
    );
  }

  const positionColors: Record<Position, string> = {
    QB: 'bg-red-500',
    RB: 'bg-blue-500',
    WR: 'bg-green-500',
    TE: 'bg-purple-500',
    K: 'bg-yellow-500',
    DST: 'bg-orange-500',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-3">{position}</h3>
      <div className="space-y-2">
        {playerCounts.map(({ player, count }) => (
          <div key={player.id} className="flex items-center gap-2">
            <div className="w-32 text-xs text-gray-700 truncate" title={player.name}>
              {player.name}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${positionColors[position]} transition-all duration-300`}
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <div className="w-8 text-xs text-gray-600 text-right font-medium">
              {count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Analysis() {
  const [selectedPosition, setSelectedPosition] = useState<Position>('QB');
  const [selectedStatsWeek, setSelectedStatsWeek] = useState<number>(2); // Default to most recent
  const [rosters, setRosters] = useState<Map<number, WeeklyRoster[]>>(new Map());
  const [players, setPlayers] = useState<Player[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [playerStatsByWeek, setPlayerStatsByWeek] = useState<Map<number, Map<string, PlayerStats>>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load all rosters, players, users, and stats
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedPlayers, fetchedUsers, wildcardStats, divisionalStats, ...weekRosters] = await Promise.all([
          getCachedPlayers(),
          getAllUsers(),
          getAllPlayerStatsForWeek('wildcard'),
          getAllPlayerStatsForWeek('divisional'),
          ...WEEKS.map(w => getAllRostersForWeek(w.week)),
        ]);

        setPlayers(fetchedPlayers);
        setUsers(fetchedUsers);

        // Build stats map per week
        const statsByWeek = new Map<number, Map<string, PlayerStats>>();

        const wildcardMap = new Map<string, PlayerStats>();
        wildcardStats.forEach(stat => {
          wildcardMap.set(stat.playerId, stat);
        });
        statsByWeek.set(1, wildcardMap);

        const divisionalMap = new Map<string, PlayerStats>();
        divisionalStats.forEach(stat => {
          divisionalMap.set(stat.playerId, stat);
        });
        statsByWeek.set(2, divisionalMap);

        setPlayerStatsByWeek(statsByWeek);

        const rosterMap = new Map<number, WeeklyRoster[]>();
        WEEKS.forEach((w, idx) => {
          rosterMap.set(w.week, weekRosters[idx]);
        });
        setRosters(rosterMap);
      } catch (err) {
        console.error('Error loading analysis data:', err);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Build player lookup map
  const playerMap = useMemo(() => {
    return new Map(players.map(p => [p.id, p]));
  }, [players]);

  // Calculate player selection counts (always across all weeks)
  const playerCounts = useMemo(() => {
    const counts = new Map<string, number>();

    // Get rosters for all weeks
    const rostersToAnalyze: WeeklyRoster[] = [];
    WEEKS.forEach(w => {
      const weekRosters = rosters.get(w.week) || [];
      rostersToAnalyze.push(...weekRosters);
    });

    // Count player selections
    for (const roster of rostersToAnalyze) {
      const playerIds = [
        roster.qb,
        roster.rb1, roster.rb2,
        roster.wr1, roster.wr2, roster.wr3,
        roster.te,
        roster.dst,
        roster.k,
      ].filter((id): id is string => id !== null);

      for (const playerId of playerIds) {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      }
    }

    return counts;
  }, [rosters]);

  // Group by position and sort by count
  const countsByPosition = useMemo(() => {
    const result: Record<Position, PlayerCount[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DST: [],
    };

    playerCounts.forEach((count, playerId) => {
      const player = playerMap.get(playerId);
      if (player) {
        result[player.position].push({ player, count });
      }
    });

    // Sort each position by count descending
    for (const pos of POSITIONS) {
      result[pos].sort((a, b) => b.count - a.count);
    }

    return result;
  }, [playerCounts, playerMap]);

  // Find max count for scaling bars
  const maxCount = useMemo(() => {
    let max = 1;
    for (const pos of POSITIONS) {
      for (const { count } of countsByPosition[pos]) {
        if (count > max) max = count;
      }
    }
    return max;
  }, [countsByPosition]);

  // Get current stats map based on selected week
  const currentPlayerStats = useMemo(() => {
    return playerStatsByWeek.get(selectedStatsWeek) || new Map<string, PlayerStats>();
  }, [playerStatsByWeek, selectedStatsWeek]);

  // Get eliminated teams based on selected stats week
  const currentEliminatedTeams = useMemo(() => {
    if (selectedStatsWeek === 1) return ELIMINATED_TEAMS_AFTER_WILDCARD;
    if (selectedStatsWeek === 2) return ELIMINATED_TEAMS_AFTER_DIVISIONAL;
    return ELIMINATED_TEAMS_AFTER_CHAMPIONSHIP;
  }, [selectedStatsWeek]);

  // Get next round name
  const nextRoundLabel = useMemo(() => {
    if (selectedStatsWeek === 1) return 'Divisional';
    if (selectedStatsWeek === 2) return 'Championship';
    return 'Super Bowl';
  }, [selectedStatsWeek]);

  // Calculate top scorers by position
  const topScorersByPosition = useMemo(() => {
    const result: Record<Position, PlayerScore[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DST: [],
    };

    players.forEach(player => {
      const stats = currentPlayerStats.get(player.id);
      if (stats) {
        const points = calculatePoints(stats, undefined, player.position);
        if (points > 0) {
          result[player.position].push({ player, points });
        }
      }
    });

    // Sort each position by points descending
    for (const pos of POSITIONS) {
      result[pos].sort((a, b) => b.points - a.points);
    }

    return result;
  }, [players, currentPlayerStats]);

  // Build user lookup map
  const userMap = useMemo(() => {
    return new Map(users.map(u => [u.uid, u]));
  }, [users]);

  // Calculate top 5 rosters with full breakdown for selected stats week
  const topRostersData = useMemo(() => {
    const weekRosters = rosters.get(selectedStatsWeek) || [];

    // Calculate points for each roster
    const rosterScores = weekRosters.map(roster => {
      const user = userMap.get(roster.odId);
      if (!user) return null;

      let totalPoints = 0;
      const playerBreakdown: { slot: string; player: Player; points: number }[] = [];

      for (const slot of ROSTER_SLOTS) {
        const playerId = roster[slot];
        if (playerId) {
          const player = playerMap.get(playerId);
          const stats = currentPlayerStats.get(playerId);
          if (player) {
            const points = stats ? calculatePoints(stats, undefined, player.position) : 0;
            totalPoints += points;
            playerBreakdown.push({ slot, player, points });
          }
        }
      }

      return { user, roster, totalPoints, playerBreakdown };
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.playerBreakdown.length > 0);

    // Sort by total points descending
    rosterScores.sort((a, b) => b.totalPoints - a.totalPoints);

    return rosterScores.slice(0, 5);
  }, [rosters, selectedStatsWeek, userMap, playerMap, currentPlayerStats]);

  // Calculate consensus players (picked by 3+ of top 5)
  const consensusPlayers = useMemo(() => {
    const topPlayerCounts = new Map<string, number>();

    for (const entry of topRostersData) {
      for (const { player } of entry.playerBreakdown) {
        topPlayerCounts.set(player.id, (topPlayerCounts.get(player.id) || 0) + 1);
      }
    }

    const consensus = new Set<string>();
    topPlayerCounts.forEach((count, playerId) => {
      if (count >= 3) consensus.add(playerId);
    });

    return consensus;
  }, [topRostersData]);

  // Calculate galaxy brain picks: top 5 scorer at position + eliminated team + infrequently selected (across ALL rosters)
  const galaxyBrainPicks = useMemo(() => {
    const picks: { user: User; player: Player; points: number; selectionRate: number; positionRank: number }[] = [];

    // Get rosters for selected stats week
    const allRosters = rosters.get(selectedStatsWeek) || [];
    const totalRosterCount = allRosters.length;
    if (totalRosterCount === 0) return [];

    // Build set of top 5 player IDs per position
    const top5ByPosition = new Map<Position, Set<string>>();
    for (const pos of POSITIONS) {
      const top5Ids = new Set(topScorersByPosition[pos].slice(0, 5).map(ps => ps.player.id));
      top5ByPosition.set(pos, top5Ids);
    }

    // Build position rank lookup
    const positionRankMap = new Map<string, number>();
    for (const pos of POSITIONS) {
      topScorersByPosition[pos].forEach((ps, idx) => {
        positionRankMap.set(ps.player.id, idx + 1);
      });
    }

    // Scan ALL rosters for galaxy brain picks
    for (const roster of allRosters) {
      const user = userMap.get(roster.odId);
      if (!user) continue;

      for (const slot of ROSTER_SLOTS) {
        const playerId = roster[slot];
        if (!playerId) continue;

        const player = playerMap.get(playerId);
        const stats = currentPlayerStats.get(playerId);
        if (!player) continue;

        const points = stats ? calculatePoints(stats, undefined, player.position) : 0;
        const isEliminated = currentEliminatedTeams.has(player.team);
        const isTop5AtPosition = top5ByPosition.get(player.position)?.has(player.id) || false;
        const selectionCount = playerCounts.get(player.id) || 0;
        const selectionRate = selectionCount / totalRosterCount;
        const positionRank = positionRankMap.get(player.id) || 99;

        // Galaxy brain: top 5 at position, eliminated team, low selection rate (<30%)
        if (isTop5AtPosition && isEliminated && selectionRate < 0.3) {
          picks.push({ user, player, points, selectionRate, positionRank });
        }
      }
    }

    // Sort by position rank (best first), then points
    picks.sort((a, b) => a.positionRank - b.positionRank || b.points - a.points);

    // Remove duplicates (keep first user for each player)
    const seen = new Set<string>();
    return picks.filter(pick => {
      const key = pick.player.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rosters, selectedStatsWeek, userMap, playerMap, currentPlayerStats, currentEliminatedTeams, playerCounts, topScorersByPosition]);

  // Get total rosters for context (always across all weeks)
  const totalRosters = useMemo(() => {
    let total = 0;
    WEEKS.forEach(w => {
      total += (rosters.get(w.week) || []).length;
    });
    return total;
  }, [rosters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Roster Analysis</h2>
          <p className="text-sm text-gray-500">
            Player selection frequency across {totalRosters} roster{totalRosters !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Previous Week Stats Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Previous Week Stats</h3>

        {/* Week Tabs */}
        <div className="flex gap-2 mb-4">
          {STATS_WEEKS.map(sw => (
            <button
              key={sw.week}
              onClick={() => setSelectedStatsWeek(sw.week)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedStatsWeek === sw.week
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sw.label}
            </button>
          ))}
        </div>

        {/* Position Selector */}
        <div className="flex gap-2 mb-4">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedPosition === pos
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-6 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
            <span className="text-gray-600">Still available for {nextRoundLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✗</div>
            <span className="text-gray-600">Eliminated (team lost)</span>
          </div>
        </div>

        {/* Single Chart */}
        <TopScorersChart
          position={selectedPosition}
          playerScores={topScorersByPosition[selectedPosition]}
          maxPoints={topScorersByPosition[selectedPosition][0]?.points || 1}
          eliminatedTeams={currentEliminatedTeams}
          availableLabel={nextRoundLabel}
        />
      </div>

      {/* What Did the Winners Pick Section */}
      {topRostersData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            What Did the Winners Pick? ({STATS_WEEKS.find(sw => sw.week === selectedStatsWeek)?.label})
          </h3>
          <WinningRosters
            topRosters={topRostersData}
            consensusPlayers={consensusPlayers}
            galaxyBrainPicks={galaxyBrainPicks}
          />
        </div>
      )}

      {/* Selection Frequency Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Player Selection Frequency</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {POSITIONS.map(pos => (
            <PositionBarChart
              key={pos}
              position={pos}
              playerCounts={countsByPosition[pos]}
              maxCount={maxCount}
            />
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Summary</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POSITIONS.map(pos => {
            const topPlayer = countsByPosition[pos][0];
            return (
              <div key={pos} className="text-sm">
                <span className="font-medium text-gray-700">{pos}:</span>{' '}
                {topPlayer ? (
                  <span className="text-gray-600">
                    {topPlayer.player.name} ({topPlayer.count} selections, {((topPlayer.count / totalRosters) * 100).toFixed(0)}%)
                  </span>
                ) : (
                  <span className="text-gray-400">No data</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
