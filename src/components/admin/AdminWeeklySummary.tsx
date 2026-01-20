import { useState, useEffect } from 'react';
import type { PlayoffWeekName, Player, User, WeeklyRoster, Position } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import {
  getAllUsers,
  getAllRostersForWeek,
  getAllPlayerStatsForWeek,
  getCachedPlayers,
  getUsedPlayers,
  saveWeeklySummary,
  getWeeklySummary,
  getPlayoffConfig,
} from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';

const WEEKS: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];
const WEEK_NUMS: Record<PlayoffWeekName, number> = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 };

interface WeekStanding {
  user: User;
  roster: WeeklyRoster | null;
  weekPoints: number;
  cumulativePoints: number;
  playerBreakdown: { player: Player; points: number }[];
  usedPlayers: Player[];
  remainingPlayers: Player[];  // Players on active teams not yet used
}

interface RemainingByPosition {
  QB: Player[];
  RB: Player[];
  WR: Player[];
  TE: Player[];
  K: Player[];
  DST: Player[];
}

export function AdminWeeklySummary() {
  const [selectedWeek, setSelectedWeek] = useState<PlayoffWeekName>('wildcard');
  const [standings, setStandings] = useState<WeekStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [existingSummary, setExistingSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load existing summary when week changes
  useEffect(() => {
    getWeeklySummary(selectedWeek).then(result => {
      if (result) {
        setExistingSummary(result.summary);
        setSummary(result.summary);
      } else {
        setExistingSummary(null);
        setSummary('');
      }
    });
    setDataLoaded(false);
  }, [selectedWeek]);

  // Load data for the selected week with cumulative standings
  async function loadWeekData() {
    setLoading(true);
    try {
      const weekNum = WEEK_NUMS[selectedWeek];

      // Load all data including cumulative stats
      const [users, players] = await Promise.all([
        getAllUsers(),
        getCachedPlayers(),
      ]);

      // Get rosters and stats for all completed weeks up to current
      const completedWeeks = WEEKS.slice(0, weekNum);
      const allWeekData = await Promise.all(
        completedWeeks.map(async (week) => {
          const wNum = WEEK_NUMS[week];
          const [rosters, stats] = await Promise.all([
            getAllRostersForWeek(wNum),
            getAllPlayerStatsForWeek(week),
          ]);
          return { week, rosters, stats };
        })
      );

      // Get next week's teams (remaining playoff teams)
      const nextWeekName = weekNum < 4 ? WEEKS[weekNum] : selectedWeek;
      const activeTeams = await getPlayoffConfig(nextWeekName);

      const playerMap = new Map(players.map(p => [p.id, p]));

      // Available players on active teams
      const activePlayers = players.filter(p => activeTeams.includes(p.team));

      const weekStandings: WeekStanding[] = [];

      for (const user of users) {
        const usedPlayerIds = await getUsedPlayers(user.uid);
        const usedPlayers = usedPlayerIds
          .map(id => playerMap.get(id))
          .filter((p): p is Player => !!p);
        const usedPlayerSet = new Set(usedPlayerIds);

        // Calculate cumulative points across all weeks
        let cumulativePoints = 0;
        let weekPoints = 0;
        const playerBreakdown: { player: Player; points: number }[] = [];

        for (const { week, rosters, stats } of allWeekData) {
          const statsMap = new Map(stats.map(s => [s.playerId, s]));
          const roster = rosters.find(r => r.odId === user.uid);

          if (roster) {
            const slots = [
              roster.qb, roster.rb1, roster.rb2,
              roster.wr1, roster.wr2, roster.wr3,
              roster.te, roster.dst, roster.k,
            ].filter(Boolean) as string[];

            for (const playerId of slots) {
              const player = playerMap.get(playerId);
              if (player) {
                const playerStats = statsMap.get(playerId);
                const points = playerStats ? calculatePoints(playerStats, undefined, player.position) : 0;
                cumulativePoints += points;

                // Only add to breakdown if this is the selected week
                if (week === selectedWeek) {
                  weekPoints += points;
                  playerBreakdown.push({ player, points });
                }
              }
            }
          }
        }

        // Sort breakdown by points desc
        playerBreakdown.sort((a, b) => b.points - a.points);

        // Calculate remaining players (on active teams, not yet used)
        const remainingPlayers = activePlayers.filter(p => !usedPlayerSet.has(p.id));

        // Check if user has a roster for this week
        const currentWeekData = allWeekData.find(d => d.week === selectedWeek);
        const currentRoster = currentWeekData?.rosters.find(r => r.odId === user.uid) || null;

        weekStandings.push({
          user,
          roster: currentRoster,
          weekPoints,
          cumulativePoints,
          playerBreakdown,
          usedPlayers,
          remainingPlayers,
        });
      }

      // Filter out users with no cumulative points, sort by cumulative points
      const activeStandings = weekStandings.filter(s => s.cumulativePoints > 0);
      activeStandings.sort((a, b) => b.cumulativePoints - a.cumulativePoints);
      setStandings(activeStandings);
      setDataLoaded(true);
    } catch (err) {
      console.error('Error loading week data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Save summary
  async function handleSave() {
    setSaving(true);
    const success = await saveWeeklySummary(selectedWeek, summary);
    if (success) {
      setExistingSummary(summary);
    }
    setSaving(false);
  }

  // Helper to group remaining players by position
  const groupByPosition = (players: Player[]): RemainingByPosition => {
    const result: RemainingByPosition = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] };
    for (const p of players) {
      if (result[p.position as Position]) {
        result[p.position as Position].push(p);
      }
    }
    return result;
  };

  // Format data for display/copying
  const formatDataForPrompt = () => {
    if (standings.length === 0) return '';

    const top10 = standings.slice(0, 10);
    const weekNum = WEEK_NUMS[selectedWeek];
    const nextWeekName = weekNum < 4 ? WEEKS[weekNum] : 'superbowl';

    let text = `=== Playoff Fantasy Pool - After ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]} ===\n\n`;

    // Overall standings
    text += `OVERALL STANDINGS (TOP 10 of ${standings.length} teams):\n`;
    text += `${'Rank'.padEnd(5)}${'Team'.padEnd(20)}${'Total Pts'.padEnd(12)}${'This Week'.padEnd(12)}Gap from 1st\n`;
    text += '-'.repeat(60) + '\n';

    const leader = standings[0]?.cumulativePoints || 0;
    top10.forEach((s, i) => {
      const gap = i === 0 ? '-' : `-${(leader - s.cumulativePoints).toFixed(1)}`;
      text += `${(i + 1 + '.').padEnd(5)}${(s.user.displayName || 'Unknown').padEnd(20)}${s.cumulativePoints.toFixed(1).padEnd(12)}${s.weekPoints.toFixed(1).padEnd(12)}${gap}\n`;
    });

    text += `\n\nTOP 10 DETAILED BREAKDOWN:\n`;
    text += `(Remaining players are those on ${PLAYOFF_WEEK_DISPLAY_NAMES[nextWeekName]} teams not yet used)\n\n`;

    top10.forEach((s, i) => {
      const byPos = groupByPosition(s.remainingPlayers);
      text += `${i + 1}. ${s.user.displayName} (${s.cumulativePoints.toFixed(1)} pts total)\n`;
      text += `   ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]} roster: ${s.playerBreakdown.map(p => `${p.player.name}(${p.points.toFixed(1)})`).join(', ') || 'No roster'}\n`;
      text += `   Remaining available:\n`;
      text += `      QB: ${byPos.QB.length > 0 ? byPos.QB.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += `      RB: ${byPos.RB.length > 0 ? byPos.RB.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += `      WR: ${byPos.WR.length > 0 ? byPos.WR.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += `      TE: ${byPos.TE.length > 0 ? byPos.TE.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += `      K: ${byPos.K.length > 0 ? byPos.K.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += `      DST: ${byPos.DST.length > 0 ? byPos.DST.map(p => p.name).join(', ') : 'NONE'}\n`;
      text += '\n';
    });

    // Analysis notes
    text += `\nANALYSIS NOTES:\n`;
    text += `- ${standings.length} total teams in the pool\n`;
    text += `- Points gap between 1st and 10th: ${(leader - (top10[9]?.cumulativePoints || 0)).toFixed(1)} pts\n`;

    // Check for position scarcity
    const topTeamsWithNoQB = top10.filter(s => groupByPosition(s.remainingPlayers).QB.length === 0).length;
    const topTeamsWithNoTE = top10.filter(s => groupByPosition(s.remainingPlayers).TE.length === 0).length;
    if (topTeamsWithNoQB > 0) text += `- ${topTeamsWithNoQB} of top 10 teams have NO remaining QBs\n`;
    if (topTeamsWithNoTE > 0) text += `- ${topTeamsWithNoTE} of top 10 teams have NO remaining TEs\n`;

    text += `\nFULL STANDINGS:\n`;
    standings.forEach((s, i) => {
      text += `${i + 1}. ${s.user.displayName}: ${s.cumulativePoints.toFixed(1)} pts\n`;
    });

    return text;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Weekly AI Summary</h2>
      <p className="text-gray-600 mb-4 text-sm">
        Generate and save AI-powered summaries for each playoff week. Load the data, then ask Claude to generate a summary based on the standings.
      </p>

      {/* Week selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Week</label>
        <div className="flex gap-2">
          {WEEKS.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                selectedWeek === week
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {PLAYOFF_WEEK_DISPLAY_NAMES[week]}
            </button>
          ))}
        </div>
      </div>

      {/* Load data button */}
      <button
        onClick={loadWeekData}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 mb-4"
      >
        {loading ? 'Loading...' : 'Load Week Data'}
      </button>

      {/* Data display */}
      {dataLoaded && standings.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium text-gray-800 mb-2">Week Data (copy this for Claude):</h3>
          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {formatDataForPrompt()}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(formatDataForPrompt())}
            className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
          >
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* Summary editor */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Weekly Summary {existingSummary ? '(existing)' : '(none saved)'}
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Paste the AI-generated summary here..."
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !summary.trim()}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
      >
        {saving ? 'Saving...' : 'Save Summary'}
      </button>

      {existingSummary && summary !== existingSummary && (
        <span className="ml-3 text-sm text-yellow-600">Unsaved changes</span>
      )}
    </div>
  );
}
