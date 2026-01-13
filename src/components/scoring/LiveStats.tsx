import { useState, useEffect, useCallback } from 'react';
import type { PlayoffWeekName, Player } from '../../types';
import { PLAYOFF_WEEK_NAMES, PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import {
  fetchNFLScoreboard,
  fetchGameBoxScore,
  toPlayerStats,
  toDefenseStats,
  toKickerStats,
  type ESPNGame,
  type ESPNBoxScore,
} from '../../services/espn';
import { getCachedPlayers, savePlayerStats, subscribeToLiveStatsConfig, type LiveStatsConfig } from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';

interface LiveStatsProps {
  currentWeek: number;
}

interface PlayerLiveStats {
  espnName: string;
  espnTeam: string;
  position: string;
  headshot?: string;
  fantasyPoints: number;
  passingYards: number;
  passingTDs: number;
  rushingYards: number;
  rushingTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  isDefense: boolean;
  pointsAllowed: number;
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  defensiveTDs: number;
}

interface KickerLiveStats {
  espnId: string;
  espnName: string;
  espnTeam: string;
  headshot?: string;
  fantasyPoints: number;
  fg0_39: number;
  fg40_49: number;
  fg50Plus: number;
  fgMade: number;
  fgMissed: number;
  xpMade: number;
  xpMissed: number;
  longFG: number;
}

export function LiveStats({ currentWeek }: LiveStatsProps) {
  const [games, setGames] = useState<ESPNGame[]>([]);
  const [boxScores, setBoxScores] = useState<ESPNBoxScore[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerLiveStats[]>([]);
  const [kickerStats, setKickerStats] = useState<KickerLiveStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [liveStatsConfig, setLiveStatsConfig] = useState<LiveStatsConfig>({ enabled: false });

  const weekName = PLAYOFF_WEEK_NAMES[currentWeek] as PlayoffWeekName;

  // Subscribe to live stats config
  useEffect(() => {
    const unsubscribe = subscribeToLiveStatsConfig(setLiveStatsConfig);
    return () => unsubscribe();
  }, []);

  // Load our players from Firebase on mount
  useEffect(() => {
    async function loadPlayers() {
      const cached = await getCachedPlayers();
      setPlayers(cached);
    }
    loadPlayers();
  }, []);

  // Normalize names for comparison (removes suffixes like Jr., Sr., III, II)
  const normalize = (name: string) =>
    name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+(jr|sr|iii|ii|iv|v)(\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Helper to find player from our collection
  const findPlayer = useCallback((espnName: string, espnTeam: string): Player | null => {
    const normalizedEspnName = normalize(espnName);

    // Try exact match first (after normalization removes suffixes)
    for (const player of players) {
      if (normalize(player.name) === normalizedEspnName && player.team === espnTeam) {
        return player;
      }
    }

    // Try first name + last name match (handles suffix differences)
    const espnParts = normalizedEspnName.split(' ');
    const espnFirstName = espnParts[0] || '';
    const espnLastName = espnParts[espnParts.length - 1] || '';

    for (const player of players) {
      const ourParts = normalize(player.name).split(' ');
      const ourFirstName = ourParts[0] || '';
      const ourLastName = ourParts[ourParts.length - 1] || '';

      // Match if first name AND last name match AND same team
      if (ourFirstName === espnFirstName && ourLastName === espnLastName && player.team === espnTeam) {
        return player;
      }
    }

    // Try last name + team match as fallback
    for (const player of players) {
      const ourLastName = normalize(player.name).split(' ').pop() || '';
      if (ourLastName === espnLastName && player.team === espnTeam) {
        return player;
      }
    }

    return null;
  }, [players]);

  // Helper to find position from our players collection
  const findPlayerPosition = useCallback((espnName: string, espnTeam: string): string | null => {
    const player = findPlayer(espnName, espnTeam);
    return player?.position || null;
  }, [findPlayer]);

  // Fetch live stats from ESPN
  const fetchLiveStats = useCallback(async () => {
    if (players.length === 0) return; // Wait for players to load

    try {
      // Fetch scoreboard first
      const scoreboardGames = await fetchNFLScoreboard();
      setGames(scoreboardGames);

      // Fetch box scores for games in progress or completed
      const newBoxScores: ESPNBoxScore[] = [];
      for (const game of scoreboardGames) {
        const status = game.status?.type?.state;
        if (status === 'in' || status === 'post') {
          const boxScore = await fetchGameBoxScore(game.id);
          if (boxScore) {
            newBoxScores.push(boxScore);
          }
        }
      }
      setBoxScores(newBoxScores);

      // Build player stats list
      const allStats: PlayerLiveStats[] = [];
      const allKickerStats: KickerLiveStats[] = [];

      // Player stats
      for (const boxScore of newBoxScores) {
        for (const espnPlayer of boxScore.players) {
          const stats = toPlayerStats(espnPlayer, '', currentWeek);

          // Only include if player has any stats
          const hasStats =
            stats.passingYards > 0 ||
            stats.rushingYards > 0 ||
            stats.receivingYards > 0 ||
            stats.passingTDs > 0 ||
            stats.rushingTDs > 0 ||
            stats.receivingTDs > 0 ||
            stats.receptions > 0;

          if (hasStats) {
            // Get position from our players collection first
            let position = findPlayerPosition(espnPlayer.name, espnPlayer.team);

            // Fallback to ESPN position or guess from stats
            if (!position) {
              position = espnPlayer.position || 'WR';
              if (stats.passingYards > 50) position = 'QB';
              else if (position !== 'QB' && position !== 'RB' && position !== 'WR' && position !== 'TE' && position !== 'K') {
                if (stats.rushingYards > stats.receivingYards) position = 'RB';
                else position = 'WR';
              }
            }

            allStats.push({
              espnName: espnPlayer.name,
              espnTeam: espnPlayer.team,
              position,
              headshot: espnPlayer.headshot,
              fantasyPoints: calculatePoints(stats, undefined, position),
              passingYards: stats.passingYards,
              passingTDs: stats.passingTDs,
              rushingYards: stats.rushingYards,
              rushingTDs: stats.rushingTDs,
              receptions: stats.receptions,
              receivingYards: stats.receivingYards,
              receivingTDs: stats.receivingTDs,
              isDefense: false,
              pointsAllowed: 0,
              sacks: 0,
              interceptions: 0,
              fumbleRecoveries: 0,
              defensiveTDs: 0,
            });
          }
        }

        // Defense stats
        for (const defense of boxScore.defenseStats) {
          const stats = toDefenseStats(defense, '', currentWeek);

          allStats.push({
            espnName: `${defense.team} Defense`,
            espnTeam: defense.team,
            position: 'DST',
            fantasyPoints: calculatePoints(stats, undefined, 'DST'),
            passingYards: 0,
            passingTDs: 0,
            rushingYards: 0,
            rushingTDs: 0,
            receptions: 0,
            receivingYards: 0,
            receivingTDs: 0,
            isDefense: true,
            pointsAllowed: defense.pointsAllowed,
            sacks: defense.sacks,
            interceptions: defense.interceptions,
            fumbleRecoveries: defense.fumbleRecoveries,
            defensiveTDs: defense.defensiveTDs,
          });
        }

        // Kicker stats
        for (const kicker of boxScore.kickerStats) {
          const stats = toKickerStats(kicker, '', currentWeek);
          allKickerStats.push({
            espnId: kicker.espnId,
            espnName: kicker.name,
            espnTeam: kicker.team,
            headshot: kicker.headshot,
            fantasyPoints: calculatePoints(stats, undefined, 'K'),
            fg0_39: kicker.fg0_39,
            fg40_49: kicker.fg40_49,
            fg50Plus: kicker.fg50Plus,
            fgMade: kicker.fgMade,
            fgMissed: kicker.fgMissed,
            xpMade: kicker.xpMade,
            xpMissed: kicker.xpMissed,
            longFG: kicker.longFG,
          });
        }
      }

      // Sort by fantasy points
      allStats.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      allKickerStats.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      setPlayerStats(allStats);
      setKickerStats(allKickerStats);
      setLastFetch(new Date());

      // Auto-sync matched players to Firebase
      let synced = 0;
      for (const stat of allStats) {
        // Find matching player in our collection
        let matchedPlayer: Player | null = null;

        if (stat.isDefense) {
          // For defense, find by team name
          matchedPlayer = players.find(
            p => p.team === stat.espnTeam && (p.position === 'DST' || p.name.includes('Defense'))
          ) || null;
        } else {
          matchedPlayer = findPlayer(stat.espnName, stat.espnTeam);
        }

        if (matchedPlayer) {
          try {
            await savePlayerStats(weekName, matchedPlayer.id, {
              passingYards: stat.passingYards,
              passingTDs: stat.passingTDs,
              interceptions: 0, // ESPN doesn't give us this in box score
              rushingYards: stat.rushingYards,
              rushingTDs: stat.rushingTDs,
              receptions: stat.receptions,
              receivingYards: stat.receivingYards,
              receivingTDs: stat.receivingTDs,
              fg0_39: 0,
              fg40_49: 0,
              fg50Plus: 0,
              fgMissed: 0,
              xpMade: 0,
              xpMissed: 0,
              pointsAllowed: stat.pointsAllowed,
              sacks: stat.sacks,
              defensiveInterceptions: stat.interceptions,
              fumbleRecoveries: 0,
              defensiveTDs: 0,
            });
            synced++;
          } catch (err) {
            console.error(`Error syncing ${stat.espnName}:`, err);
          }
        }
      }
      // Sync kicker stats to Firebase
      for (const kicker of allKickerStats) {
        // Find matching kicker in our collection
        const matchedKicker = findPlayer(kicker.espnName, kicker.espnTeam);

        if (matchedKicker) {
          try {
            await savePlayerStats(weekName, matchedKicker.id, {
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
            });
            synced++;
          } catch (err) {
            console.error(`Error syncing kicker ${kicker.espnName}:`, err);
          }
        }
      }

      setSyncCount(synced);
      setLastSync(new Date());
    } catch (err) {
      console.error('Error fetching live stats:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWeek, players, findPlayerPosition, findPlayer, weekName]);

  // Fetch stats when players are loaded, live stats enabled, and auto-refresh every 60 seconds
  useEffect(() => {
    if (players.length === 0 || !liveStatsConfig.enabled) return;

    fetchLiveStats();

    const interval = setInterval(() => {
      fetchLiveStats();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchLiveStats, players.length, liveStatsConfig.enabled]);

  // Split stats by category
  const offensiveStats = playerStats.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
  const defenseStats = playerStats.filter(p => p.position === 'DST');
  // Note: kickerStats comes from state (populated from ESPNKickerStats), not filtered from playerStats

  // Get game status badge
  const getGameStatusBadge = (game: ESPNGame) => {
    const state = game.status?.type?.state;
    const desc = game.status?.type?.description;

    if (state === 'pre') {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Upcoming</span>;
    } else if (state === 'in') {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded animate-pulse">LIVE - {desc}</span>;
    } else {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Final</span>;
    }
  };

  if (loading && liveStatsConfig.enabled) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Show placeholder when live stats are disabled
  if (!liveStatsConfig.enabled) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">🏈</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Live Stats Coming Soon
          </h3>
          <p className="text-gray-500">
            Live stats will be available when {PLAYOFF_WEEK_DISPLAY_NAMES[weekName]} games begin.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Check back during game time for real-time player stats!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Live Stats</h2>
          <p className="text-sm text-gray-500">
            Real-time player stats for {PLAYOFF_WEEK_DISPLAY_NAMES[weekName]}
          </p>
        </div>
        {lastFetch && (
          <div className="text-right">
            <p className="text-xs text-gray-500">
              Auto-refreshes & syncs every 60s
            </p>
            <p className="text-xs text-gray-400">
              Last fetch: {lastFetch.toLocaleTimeString()}
              {lastSync && ` | Synced ${syncCount} players`}
            </p>
          </div>
        )}
      </div>

      {/* Games Overview */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">Games</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              const boxScore = boxScores.find((bs) => bs.gameId === game.id);
              return (
                <div
                  key={game.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{game.shortName}</span>
                    {getGameStatusBadge(game)}
                  </div>
                  {boxScore && (
                    <div className="text-lg font-bold text-gray-900">
                      {boxScore.awayScore} - {boxScore.homeScore}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Offensive Player Stats Table */}
      {offensiveStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">
              Player Stats ({offensiveStats.length} players)
            </h3>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Player</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Pos</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Team</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Fantasy Pts</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Pass</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Rush</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Rec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offensiveStats.map((player, idx) => (
                  <tr
                    key={`${player.espnName}-${player.espnTeam}-${idx}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {player.headshot ? (
                          <img
                            src={player.headshot}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {player.position}
                          </div>
                        )}
                        <span className="font-medium">{player.espnName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        player.position === 'QB' ? 'bg-red-100 text-red-700' :
                        player.position === 'RB' ? 'bg-blue-100 text-blue-700' :
                        player.position === 'WR' ? 'bg-green-100 text-green-700' :
                        player.position === 'TE' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {player.position}
                      </span>
                    </td>
                    <td className="py-2 px-3">{player.espnTeam}</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {player.fantasyPoints.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {player.passingYards > 0
                        ? `${player.passingYards}/${player.passingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {player.rushingYards > 0
                        ? `${player.rushingYards}/${player.rushingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {player.receptions > 0 || player.receivingYards > 0
                        ? `${player.receptions}rec/${player.receivingYards}yds/${player.receivingTDs}TD`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Defense Stats Table */}
      {defenseStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">
              Defense/Special Teams ({defenseStats.length} teams)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Team</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Fantasy Pts</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Pts Allowed</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Sacks</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">INTs</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Fum Rec</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Def TD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {defenseStats.map((player, idx) => (
                  <tr
                    key={`${player.espnTeam}-dst-${idx}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                          DST
                        </span>
                        <span className="font-medium">{player.espnName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {player.fantasyPoints.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">{player.pointsAllowed}</td>
                    <td className="py-2 px-3 text-right">{player.sacks}</td>
                    <td className="py-2 px-3 text-right">{player.interceptions}</td>
                    <td className="py-2 px-3 text-right">{player.fumbleRecoveries}</td>
                    <td className="py-2 px-3 text-right">{player.defensiveTDs > 0 ? player.defensiveTDs : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kicker Stats Table */}
      {kickerStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">
              Kickers ({kickerStats.length} players)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Player</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Team</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Fantasy Pts</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">FG 0-39</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">FG 40-49</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">FG 50+</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">FG Miss</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">XP</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Long</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kickerStats.map((kicker, idx) => (
                  <tr
                    key={`${kicker.espnName}-k-${idx}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {kicker.headshot ? (
                          <img
                            src={kicker.headshot}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            K
                          </div>
                        )}
                        <span className="font-medium">{kicker.espnName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">{kicker.espnTeam}</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {kicker.fantasyPoints.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {kicker.fg0_39 > 0 ? kicker.fg0_39 : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {kicker.fg40_49 > 0 ? kicker.fg40_49 : '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-green-700 font-medium">
                      {kicker.fg50Plus > 0 ? kicker.fg50Plus : '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {kicker.fgMissed > 0 ? kicker.fgMissed : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {kicker.xpMade}/{kicker.xpMade + kicker.xpMissed}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {kicker.longFG > 0 ? `${kicker.longFG}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && playerStats.length === 0 && games.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No live games at the moment</p>
          <p className="text-sm text-gray-400 mt-2">
            Stats will appear when games are in progress
          </p>
        </div>
      )}
    </div>
  );
}
