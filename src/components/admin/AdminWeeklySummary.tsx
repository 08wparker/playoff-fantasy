import { useState, useEffect } from 'react';
import type { PlayoffWeekName, Player, User, WeeklyRoster } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import {
  getAllUsers,
  getAllRostersForWeek,
  getAllPlayerStatsForWeek,
  getCachedPlayers,
  getUsedPlayers,
  saveWeeklySummary,
  getWeeklySummary,
} from '../../services/firebase';
import { calculatePoints } from '../../services/scoring';

const WEEKS: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];

interface WeekStanding {
  user: User;
  roster: WeeklyRoster | null;
  weekPoints: number;
  playerBreakdown: { player: Player; points: number }[];
  usedPlayers: Player[];
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

  // Load data for the selected week
  async function loadWeekData() {
    setLoading(true);
    try {
      const weekNum = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 }[selectedWeek];

      const [users, rosters, statsData, players] = await Promise.all([
        getAllUsers(),
        getAllRostersForWeek(weekNum),
        getAllPlayerStatsForWeek(selectedWeek),
        getCachedPlayers(),
      ]);

      const playerMap = new Map(players.map(p => [p.id, p]));
      const statsMap = new Map(statsData.map(s => [s.playerId, s]));
      const rosterMap = new Map(rosters.map(r => [r.odId, r]));

      const weekStandings: WeekStanding[] = [];

      for (const user of users) {
        const roster = rosterMap.get(user.uid) || null;
        const usedPlayerIds = await getUsedPlayers(user.uid);
        const usedPlayers = usedPlayerIds
          .map(id => playerMap.get(id))
          .filter((p): p is Player => !!p);

        let weekPoints = 0;
        const playerBreakdown: { player: Player; points: number }[] = [];

        if (roster) {
          const slots = [
            roster.qb, roster.rb1, roster.rb2,
            roster.wr1, roster.wr2, roster.wr3,
            roster.te, roster.dst, roster.k,
          ].filter(Boolean) as string[];

          for (const playerId of slots) {
            const player = playerMap.get(playerId);
            if (player) {
              const stats = statsMap.get(playerId);
              const points = stats ? calculatePoints(stats, undefined, player.position) : 0;
              weekPoints += points;
              playerBreakdown.push({ player, points });
            }
          }

          // Sort by points desc
          playerBreakdown.sort((a, b) => b.points - a.points);
        }

        weekStandings.push({
          user,
          roster,
          weekPoints,
          playerBreakdown,
          usedPlayers,
        });
      }

      // Filter out users who didn't set a roster, then sort by week points
      const activeStandings = weekStandings.filter(s => s.roster && s.playerBreakdown.length > 0);
      activeStandings.sort((a, b) => b.weekPoints - a.weekPoints);
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

  // Format data for display/copying
  const formatDataForPrompt = () => {
    if (standings.length === 0) return '';

    const top3 = standings.slice(0, 3);
    const last = standings[standings.length - 1];

    let text = `=== ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]} Fantasy Summary Data ===\n\n`;

    text += `TOP 3 FINISHERS:\n`;
    top3.forEach((s, i) => {
      text += `\n${i + 1}. ${s.user.displayName} - ${s.weekPoints.toFixed(2)} pts\n`;
      text += `   Roster: ${s.playerBreakdown.map(p => `${p.player.name} (${p.player.position}, ${p.player.team}): ${p.points.toFixed(1)}`).join(', ')}\n`;
      text += `   All used players: ${s.usedPlayers.map(p => `${p.name} (${p.team})`).join(', ')}\n`;
    });

    if (last && !top3.includes(last)) {
      text += `\nLAST PLACE:\n`;
      text += `${standings.length}. ${last.user.displayName} - ${last.weekPoints.toFixed(2)} pts\n`;
      text += `   Roster: ${last.playerBreakdown.map(p => `${p.player.name} (${p.player.position}, ${p.player.team}): ${p.points.toFixed(1)}`).join(', ')}\n`;
      text += `   All used players: ${last.usedPlayers.map(p => `${p.name} (${p.team})`).join(', ')}\n`;
    }

    text += `\nFULL STANDINGS:\n`;
    standings.forEach((s, i) => {
      text += `${i + 1}. ${s.user.displayName}: ${s.weekPoints.toFixed(2)} pts\n`;
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
