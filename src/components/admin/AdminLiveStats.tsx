import { useState, useEffect, useCallback } from 'react';
import type { PlayoffWeekName, Player, PlayerStats } from '../../types';
import { PLAYOFF_WEEK_NAMES, PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import {
  fetchNFLScoreboard,
  fetchGameBoxScore,
  matchPlayer,
  toPlayerStats,
  toDefenseStats,
  toKickerStats,
  type ESPNGame,
  type ESPNBoxScore,
} from '../../services/espn';
import { getCachedPlayers, savePlayerStats, cachePlayer, setLiveStatsEnabled, subscribeToLiveStatsConfig, type LiveStatsConfig } from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';

interface AdminLiveStatsProps {
  currentWeek: number;
}

interface MatchedPlayerStats {
  espnName: string;
  espnTeam: string;
  matchedPlayer: Player | null;
  stats: PlayerStats;
  fantasyPoints: number;
  isDefense: boolean;
}

interface MatchedKickerStats {
  espnName: string;
  espnTeam: string;
  matchedPlayer: Player | null;
  stats: PlayerStats;
  fantasyPoints: number;
  fg0_39: number;
  fg40_49: number;
  fg50Plus: number;
  fgMissed: number;
  xpMade: number;
  xpMissed: number;
  longFG: number;
}

export function AdminLiveStats({ currentWeek }: AdminLiveStatsProps) {
  const [games, setGames] = useState<ESPNGame[]>([]);
  const [boxScores, setBoxScores] = useState<ESPNBoxScore[]>([]);
  const [matchedStats, setMatchedStats] = useState<MatchedPlayerStats[]>([]);
  const [kickerStats, setKickerStats] = useState<MatchedKickerStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveStatsConfig, setLiveStatsConfig] = useState<LiveStatsConfig>({ enabled: false });
  const [togglingLiveStats, setTogglingLiveStats] = useState(false);

  const weekName = PLAYOFF_WEEK_NAMES[currentWeek] as PlayoffWeekName;

  // Subscribe to live stats config
  useEffect(() => {
    const unsubscribe = subscribeToLiveStatsConfig(setLiveStatsConfig);
    return () => unsubscribe();
  }, []);

  // Toggle live stats enabled
  const handleToggleLiveStats = async () => {
    setTogglingLiveStats(true);
    await setLiveStatsEnabled(!liveStatsConfig.enabled);
    setTogglingLiveStats(false);
  };

  // Load our players from Firebase
  useEffect(() => {
    async function loadPlayers() {
      const cached = await getCachedPlayers();
      setPlayers(cached);
    }
    loadPlayers();
  }, []);

  // Fetch live stats from ESPN
  const fetchLiveStats = useCallback(async () => {
    setLoading(true);
    setError(null);

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

      // Match ESPN players to our players
      const matched: MatchedPlayerStats[] = [];
      const matchedKickers: MatchedKickerStats[] = [];

      // Player stats
      for (const boxScore of newBoxScores) {
        for (const espnPlayer of boxScore.players) {
          const matchedId = matchPlayer(espnPlayer, players);
          const matchedPlayer = matchedId ? players.find(p => p.id === matchedId) || null : null;

          const stats = toPlayerStats(
            espnPlayer,
            matchedId || `espn-${espnPlayer.espnId}`,
            currentWeek
          );

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
            matched.push({
              espnName: espnPlayer.name,
              espnTeam: espnPlayer.team,
              matchedPlayer,
              stats,
              fantasyPoints: calculatePoints(stats, undefined, matchedPlayer?.position),
              isDefense: false,
            });
          }
        }

        // Defense stats
        for (const defense of boxScore.defenseStats) {
          // Find defense player in our roster
          const defensePlayer = players.find(
            p => p.team === defense.team && (p.position === 'DST' || p.name.includes('Defense'))
          );

          const stats = toDefenseStats(
            defense,
            defensePlayer?.id || `defense-${defense.team}`,
            currentWeek
          );

          matched.push({
            espnName: `${defense.team} Defense`,
            espnTeam: defense.team,
            matchedPlayer: defensePlayer || null,
            stats,
            fantasyPoints: calculatePoints(stats, undefined, 'DST'),
            isDefense: true,
          });
        }

        // Kicker stats
        for (const kicker of boxScore.kickerStats) {
          // Find kicker in our roster
          const matchedKicker = players.find(
            p => p.team === kicker.team && p.position === 'K'
          );

          const stats = toKickerStats(
            kicker,
            matchedKicker?.id || `kicker-${kicker.team}`,
            currentWeek
          );

          matchedKickers.push({
            espnName: kicker.name,
            espnTeam: kicker.team,
            matchedPlayer: matchedKicker || null,
            stats,
            fantasyPoints: calculatePoints(stats, undefined, 'K'),
            fg0_39: kicker.fg0_39,
            fg40_49: kicker.fg40_49,
            fg50Plus: kicker.fg50Plus,
            fgMissed: kicker.fgMissed,
            xpMade: kicker.xpMade,
            xpMissed: kicker.xpMissed,
            longFG: kicker.longFG,
          });
        }
      }

      // Sort by fantasy points
      matched.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      matchedKickers.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
      setMatchedStats(matched);
      setKickerStats(matchedKickers);
      setLastFetch(new Date());
    } catch (err) {
      console.error('Error fetching live stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch live stats');
    } finally {
      setLoading(false);
    }
  }, [players, currentWeek]);

  // Auto-refresh every 60 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLiveStats();
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveStats]);

  // Sync matched stats to Firebase
  const syncToFirebase = async () => {
    setSyncing(true);
    setError(null);

    try {
      let syncCount = 0;

      // Sync player stats
      for (const matched of matchedStats) {
        // Only sync if we have a matched player
        if (matched.matchedPlayer) {
          const { playerId, week, ...statsWithoutMeta } = matched.stats;
          await savePlayerStats(weekName, matched.matchedPlayer.id, statsWithoutMeta);
          syncCount++;
        }
      }

      // Sync kicker stats
      for (const kicker of kickerStats) {
        if (kicker.matchedPlayer) {
          const { playerId, week, ...statsWithoutMeta } = kicker.stats;
          await savePlayerStats(weekName, kicker.matchedPlayer.id, statsWithoutMeta);
          syncCount++;
        }
      }

      alert(`Synced ${syncCount} player stats to Firebase!`);
    } catch (err) {
      console.error('Error syncing stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync stats');
    } finally {
      setSyncing(false);
    }
  };

  // Add missing players to Firebase
  const addMissingPlayers = async () => {
    setSyncing(true);
    setError(null);

    try {
      let addCount = 0;
      const missingPlayers = matchedStats.filter(m => !m.matchedPlayer && !m.isDefense);

      for (const missing of missingPlayers) {
        // Get ESPN player info from boxScores
        let espnPlayer = null;
        for (const boxScore of boxScores) {
          espnPlayer = boxScore.players.find(p => p.name === missing.espnName && p.team === missing.espnTeam);
          if (espnPlayer) break;
        }

        if (espnPlayer) {
          // Create a player ID from name (lowercase, no spaces)
          const playerId = missing.espnName.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-');

          // Map ESPN position to our position type
          let position = espnPlayer.position as any;
          if (position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE' || position === 'K') {
            // Position is valid
          } else {
            // Default to position based on stats
            if (missing.stats.passingYards > 0) position = 'QB';
            else if (missing.stats.rushingYards > missing.stats.receivingYards) position = 'RB';
            else position = 'WR';
          }

          const newPlayer = {
            id: playerId,
            name: missing.espnName,
            team: missing.espnTeam as any,
            position: position,
            imageUrl: espnPlayer.headshot || undefined,
          };

          await cachePlayer(newPlayer);
          addCount++;
        }
      }

      // Reload players after adding
      const cached = await getCachedPlayers();
      setPlayers(cached);

      alert(`Added ${addCount} missing players to Firebase!`);
    } catch (err) {
      console.error('Error adding missing players:', err);
      setError(err instanceof Error ? err.message : 'Failed to add missing players');
    } finally {
      setSyncing(false);
    }
  };

  // Count unmatched players
  const unmatchedCount = matchedStats.filter(m => !m.matchedPlayer && !m.isDefense).length;

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

  return (
    <div className="space-y-6">
      {/* Live Stats Public Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Public Live Stats Tab</h3>
            <p className="text-sm text-gray-500">
              {liveStatsConfig.enabled
                ? 'Users can see live stats on the Live Stats tab'
                : 'Live Stats tab is hidden from users (shows previous week scores)'}
            </p>
          </div>
          <button
            onClick={handleToggleLiveStats}
            disabled={togglingLiveStats}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              liveStatsConfig.enabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            } disabled:opacity-50`}
          >
            {togglingLiveStats ? 'Updating...' : liveStatsConfig.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Live Stats (ESPN) - Admin View</h2>
          <p className="text-sm text-gray-500">
            Fetch real-time player stats from ESPN for {PLAYOFF_WEEK_DISPLAY_NAMES[weekName]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh (60s)
          </label>
          <button
            onClick={fetchLiveStats}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Fetching...' : 'Fetch Live Stats'}
          </button>
        </div>
      </div>

      {/* Last fetch time */}
      {lastFetch && (
        <p className="text-xs text-gray-500">
          Last updated: {lastFetch.toLocaleTimeString()}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Games Overview */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">Games Today</h3>
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

      {/* Matched Stats Table */}
      {matchedStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">
              Player Stats ({matchedStats.length} players, {unmatchedCount} unmatched)
            </h3>
            <div className="flex gap-2">
              {unmatchedCount > 0 && (
                <button
                  onClick={addMissingPlayers}
                  disabled={syncing}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {syncing ? 'Adding...' : `Add ${unmatchedCount} Missing Players`}
                </button>
              )}
              <button
                onClick={syncToFirebase}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Stats to Firebase'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">ESPN Player</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Team</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Matched To</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Fantasy Pts</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Pass</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Rush</th>
                  <th className="py-2 px-3 text-right font-medium text-gray-600">Rec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedStats.map((matched, idx) => (
                  <tr
                    key={`${matched.espnName}-${matched.espnTeam}-${idx}`}
                    className={`${
                      matched.matchedPlayer
                        ? 'bg-green-50'
                        : 'bg-yellow-50'
                    } hover:bg-gray-50`}
                  >
                    <td className="py-2 px-3 font-medium">{matched.espnName}</td>
                    <td className="py-2 px-3">{matched.espnTeam}</td>
                    <td className="py-2 px-3">
                      {matched.matchedPlayer ? (
                        <span className="text-green-700">
                          {matched.matchedPlayer.name}
                        </span>
                      ) : (
                        <span className="text-yellow-700">No match</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold">
                      {matched.fantasyPoints.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {matched.stats.passingYards > 0
                        ? `${matched.stats.passingYards}/${matched.stats.passingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {matched.stats.rushingYards > 0
                        ? `${matched.stats.rushingYards}/${matched.stats.rushingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {matched.isDefense
                        ? `${matched.stats.pointsAllowed}PA`
                        : matched.stats.receptions > 0 || matched.stats.receivingYards > 0
                        ? `${matched.stats.receptions}rec/${matched.stats.receivingYards}yds/${matched.stats.receivingTDs}TD`
                        : '-'}
                    </td>
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
              Kicker Stats ({kickerStats.length} kickers)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">ESPN Player</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Team</th>
                  <th className="py-2 px-3 text-left font-medium text-gray-600">Matched To</th>
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
                    key={`${kicker.espnName}-${kicker.espnTeam}-${idx}`}
                    className={`${
                      kicker.matchedPlayer
                        ? 'bg-green-50'
                        : 'bg-yellow-50'
                    } hover:bg-gray-50`}
                  >
                    <td className="py-2 px-3 font-medium">{kicker.espnName}</td>
                    <td className="py-2 px-3">{kicker.espnTeam}</td>
                    <td className="py-2 px-3">
                      {kicker.matchedPlayer ? (
                        <span className="text-green-700">
                          {kicker.matchedPlayer.name}
                        </span>
                      ) : (
                        <span className="text-yellow-700">No match</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold">
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
      {!loading && matchedStats.length === 0 && kickerStats.length === 0 && games.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            Click "Fetch Live Stats" to get current game data from ESPN
          </p>
        </div>
      )}
    </div>
  );
}
