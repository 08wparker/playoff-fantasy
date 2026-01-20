import { useState, useEffect } from 'react';
import type { PlayoffWeekName, Player, PlayerStats } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import { getCachedPlayers, getAllPlayerStatsForWeek, getPlayoffConfig } from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';

interface WeeklyPlayerStatsProps {
  currentWeek: number;
}

interface DisplayStats {
  player: Player;
  stats: PlayerStats;
  fantasyPoints: number;
}

// Available weeks for stats (completed rounds)
const STATS_WEEKS: { week: number; name: PlayoffWeekName; label: string }[] = [
  { week: 1, name: 'wildcard', label: 'Wild Card' },
  { week: 2, name: 'divisional', label: 'Divisional' },
];

// Game scores by round (hardcoded since games are final)
const GAMES_BY_WEEK: Record<PlayoffWeekName, { shortName: string; awayScore: number; homeScore: number }[]> = {
  wildcard: [
    { shortName: 'LAR @ CAR', awayScore: 34, homeScore: 31 },
    { shortName: 'GB @ CHI', awayScore: 27, homeScore: 31 },
    { shortName: 'BUF @ JAX', awayScore: 27, homeScore: 24 },
    { shortName: 'SF @ PHI', awayScore: 23, homeScore: 19 },
    { shortName: 'LAC @ NE', awayScore: 3, homeScore: 16 },
    { shortName: 'HOU @ PIT', awayScore: 30, homeScore: 6 },
  ],
  divisional: [
    { shortName: 'DEN @ NE', awayScore: 24, homeScore: 30 },
    { shortName: 'HOU @ BUF', awayScore: 14, homeScore: 31 },
    { shortName: 'CHI @ SEA', awayScore: 21, homeScore: 28 },
    { shortName: 'SF @ LAR', awayScore: 21, homeScore: 28 },
  ],
  championship: [],
  superbowl: [],
};

export function WeeklyPlayerStats({ currentWeek }: WeeklyPlayerStatsProps) {
  // Filter to only show completed weeks (weeks before current)
  const availableWeeks = STATS_WEEKS.filter(w => w.week < currentWeek);
  const [selectedWeek, setSelectedWeek] = useState<PlayoffWeekName>(
    availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1].name : 'wildcard'
  );
  const [stats, setStats] = useState<DisplayStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Load players and stats in parallel
        const [allPlayers, weekStats, weekTeams] = await Promise.all([
          getCachedPlayers(),
          getAllPlayerStatsForWeek(selectedWeek),
          getPlayoffConfig(selectedWeek),
        ]);

        // Create a map of player stats by playerId
        const statsMap = new Map<string, PlayerStats>();
        weekStats.forEach(s => statsMap.set(s.playerId, s));

        // Filter players to only those with stats and on teams from this week
        const displayStats: DisplayStats[] = [];

        for (const player of allPlayers) {
          const playerStats = statsMap.get(player.id);
          if (playerStats && weekTeams.includes(player.team)) {
            const points = calculatePoints(playerStats, undefined, player.position);
            displayStats.push({
              player,
              stats: playerStats,
              fantasyPoints: points,
            });
          }
        }

        // Sort by fantasy points descending
        displayStats.sort((a, b) => b.fantasyPoints - a.fantasyPoints);
        setStats(displayStats);
      } catch (err) {
        console.error('Error loading weekly stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedWeek]);

  // Split stats by position category
  const offensiveStats = stats.filter(s => ['QB', 'RB', 'WR', 'TE'].includes(s.player.position));
  const defenseStats = stats.filter(s => s.player.position === 'DST');
  const kickerStats = stats.filter(s => s.player.position === 'K');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const currentGames = GAMES_BY_WEEK[selectedWeek] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Previous Week Stats
          </h2>
          <p className="text-sm text-gray-500">
            Final player stats for completed playoff rounds
          </p>
        </div>
        <div className="text-right">
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Final</span>
        </div>
      </div>

      {/* Week Tabs */}
      {availableWeeks.length > 1 && (
        <div className="flex gap-2">
          {availableWeeks.map(w => (
            <button
              key={w.week}
              onClick={() => setSelectedWeek(w.name)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedWeek === w.name
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {/* Games Overview */}
      {currentGames.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">Games</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentGames.map((game) => (
              <div
                key={game.shortName}
                className="p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{game.shortName}</span>
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Final</span>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {game.awayScore} - {game.homeScore}
                </div>
              </div>
            ))}
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
                {offensiveStats.map(({ player, stats: s }) => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {player.imageUrl ? (
                          <img
                            src={player.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {player.position}
                          </div>
                        )}
                        <span className="font-medium">{player.name}</span>
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
                    <td className="py-2 px-3">{player.team}</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {calculatePoints(s, undefined, player.position).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.passingYards > 0
                        ? `${s.passingYards}/${s.passingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.rushingYards > 0
                        ? `${s.rushingYards}/${s.rushingTDs}TD`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.receptions > 0 || s.receivingYards > 0
                        ? `${s.receptions}rec/${s.receivingYards}yds/${s.receivingTDs}TD`
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
                {defenseStats.map(({ player, stats: s }) => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                          DST
                        </span>
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {calculatePoints(s, undefined, 'DST').toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">{s.pointsAllowed}</td>
                    <td className="py-2 px-3 text-right">{s.sacks}</td>
                    <td className="py-2 px-3 text-right">{s.defensiveInterceptions}</td>
                    <td className="py-2 px-3 text-right">{s.fumbleRecoveries}</td>
                    <td className="py-2 px-3 text-right">{s.defensiveTDs > 0 ? s.defensiveTDs : '-'}</td>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kickerStats.map(({ player, stats: s }) => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {player.imageUrl ? (
                          <img
                            src={player.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            K
                          </div>
                        )}
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">{player.team}</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-700">
                      {calculatePoints(s, undefined, 'K').toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.fg0_39 > 0 ? s.fg0_39 : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.fg40_49 > 0 ? s.fg40_49 : '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-green-700 font-medium">
                      {s.fg50Plus > 0 ? s.fg50Plus : '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {s.fgMissed > 0 ? s.fgMissed : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {s.xpMade}/{s.xpMade + s.xpMissed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No stats available for {PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]}</p>
        </div>
      )}
    </div>
  );
}
