import { useState, useEffect, useCallback } from 'react';
import type { PlayoffWeekName, Player, PlayerStats, User, WeeklyRoster } from '../../types';
import { PLAYOFF_WEEK_NAMES, PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';
import { formatPoints, calculatePoints } from '../../services/scoring';
import { getAllUsers, getAllRostersForWeek, getAllPlayerStatsForWeek, getCachedPlayers } from '../../services/firebase';
import type { MultiWeekStanding } from '../../hooks/useScoring';

const WEEKS: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];
type TabType = 'overall' | PlayoffWeekName;

interface ScoreboardProps {
  standings: MultiWeekStanding[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}

// Week-specific roster score with player breakdown
interface WeekRosterScore {
  user: User;
  roster: WeeklyRoster;
  playerScores: {
    player: Player;
    stats: PlayerStats | null;
    points: number;
  }[];
  totalPoints: number;
}

export function Scoreboard({
  standings,
  loading,
  error,
  onRefresh,
}: ScoreboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overall');
  const [weekData, setWeekData] = useState<WeekRosterScore[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Auto-refresh overall standings when component mounts
  useEffect(() => {
    onRefresh();
  }, []);

  // Load week-specific data when a week tab is selected
  const loadWeekData = useCallback(async (weekName: PlayoffWeekName) => {
    setWeekLoading(true);
    try {
      const weekNum = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 }[weekName];

      const [users, rosters, statsData, players] = await Promise.all([
        getAllUsers(),
        getAllRostersForWeek(weekNum),
        getAllPlayerStatsForWeek(weekName),
        getCachedPlayers(),
      ]);

      // Create maps for quick lookup
      const statsMap = new Map<string, PlayerStats>();
      statsData.forEach(s => statsMap.set(s.playerId, s));

      const playerMap = new Map<string, Player>();
      players.forEach(p => playerMap.set(p.id, p));

      // Build roster scores
      const rosterScores: WeekRosterScore[] = [];

      for (const roster of rosters) {
        const user = users.find(u => u.uid === roster.odId);
        if (!user) continue;

        const slots = [
          { id: roster.qb, position: 'QB' },
          { id: roster.rb1, position: 'RB' },
          { id: roster.rb2, position: 'RB' },
          { id: roster.wr1, position: 'WR' },
          { id: roster.wr2, position: 'WR' },
          { id: roster.wr3, position: 'WR' },
          { id: roster.te, position: 'TE' },
          { id: roster.dst, position: 'D/ST' },
          { id: roster.k, position: 'K' },
        ];

        const playerScores: WeekRosterScore['playerScores'] = [];
        let totalPoints = 0;

        for (const slot of slots) {
          if (!slot.id) continue;

          const player = playerMap.get(slot.id);
          if (!player) continue;

          const stats = statsMap.get(slot.id) || null;
          const points = stats ? calculatePoints(stats) : 0;

          playerScores.push({ player, stats, points });
          totalPoints += points;
        }

        rosterScores.push({ user, roster, playerScores, totalPoints });
      }

      // Sort by total points
      rosterScores.sort((a, b) => b.totalPoints - a.totalPoints);
      setWeekData(rosterScores);
    } catch (err) {
      console.error('Error loading week data:', err);
    } finally {
      setWeekLoading(false);
    }
  }, []);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setExpandedUser(null);
    if (tab === 'overall') {
      onRefresh();
    } else {
      loadWeekData(tab);
    }
  };

  const isLoading = activeTab === 'overall' ? loading : weekLoading;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1 overflow-x-auto">
        <button
          onClick={() => handleTabChange('overall')}
          className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'overall'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Overall
        </button>
        {WEEKS.map(week => (
          <button
            key={week}
            onClick={() => handleTabChange(week)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === week
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {PLAYOFF_WEEK_DISPLAY_NAMES[week]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Overall Standings Table */}
      {!isLoading && activeTab === 'overall' && (
        <OverallStandings standings={standings} onRefresh={onRefresh} />
      )}

      {/* Week-specific Standings */}
      {!isLoading && activeTab !== 'overall' && (
        <WeekStandings
          weekName={activeTab}
          rosterScores={weekData}
          expandedUser={expandedUser}
          onExpandUser={setExpandedUser}
          onRefresh={() => loadWeekData(activeTab)}
        />
      )}
    </div>
  );
}

// Overall standings table component
function OverallStandings({
  standings,
  onRefresh,
}: {
  standings: MultiWeekStanding[];
  onRefresh: () => Promise<void>;
}) {
  if (standings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No scores yet</p>
        <p className="text-gray-400 text-sm mt-2">
          Scores will appear once rosters are saved and player stats are entered
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Playoff Standings</h2>
        <button
          onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Player</th>
                {WEEKS.map(week => (
                  <th key={week} className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">
                    {PLAYOFF_WEEK_DISPLAY_NAMES[week]}
                  </th>
                ))}
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase bg-primary-50">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {standings.map((entry, index) => (
                <tr key={entry.user.uid} className={`hover:bg-gray-50 ${index === 0 ? 'bg-yellow-50' : ''}`}>
                  <td className="py-3 px-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {entry.user.photoURL && (
                        <img src={entry.user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                      )}
                      <span className="font-medium text-gray-900">{entry.user.displayName || 'Anonymous'}</span>
                    </div>
                  </td>
                  {WEEKS.map(week => (
                    <td key={week} className="py-3 px-4 text-center">
                      <span className={`font-medium ${entry.weeklyPoints[week] > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {entry.weeklyPoints[week] > 0 ? formatPoints(entry.weeklyPoints[week]) : '-'}
                      </span>
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center bg-primary-50">
                    <span className="font-bold text-lg text-primary-700">{formatPoints(entry.totalPoints)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Week-specific standings with expandable roster view
function WeekStandings({
  weekName,
  rosterScores,
  expandedUser,
  onExpandUser,
  onRefresh,
}: {
  weekName: PlayoffWeekName;
  rosterScores: WeekRosterScore[];
  expandedUser: string | null;
  onExpandUser: (uid: string | null) => void;
  onRefresh: () => void;
}) {
  if (rosterScores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No rosters for {PLAYOFF_WEEK_DISPLAY_NAMES[weekName]}</p>
        <p className="text-gray-400 text-sm mt-2">
          Rosters will appear once players save them for this week
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {PLAYOFF_WEEK_DISPLAY_NAMES[weekName]} Standings
        </h2>
        <button
          onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {rosterScores.map((entry, index) => (
          <div
            key={entry.user.uid}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* User Header */}
            <button
              onClick={() => onExpandUser(expandedUser === entry.user.uid ? null : entry.user.uid)}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                index === 1 ? 'bg-gray-100 text-gray-600' :
                index === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-gray-50 text-gray-500'
              }`}>
                {index + 1}
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 flex-1">
                {entry.user.photoURL && (
                  <img src={entry.user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">{entry.user.displayName || 'Anonymous'}</p>
                  <p className="text-xs text-gray-500">
                    {entry.roster.locked ? 'Locked' : 'Not locked'}
                  </p>
                </div>
              </div>

              {/* Total Points */}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{formatPoints(entry.totalPoints)}</p>
                <p className="text-xs text-gray-500">points</p>
              </div>

              {/* Expand Icon */}
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedUser === entry.user.uid ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded Player Details */}
            {expandedUser === entry.user.uid && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Roster Breakdown</h4>
                <div className="space-y-2">
                  {entry.playerScores.map((ps) => (
                    <div
                      key={ps.player.id}
                      className="flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        {ps.player.imageUrl ? (
                          <img src={ps.player.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {ps.player.position}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm text-gray-900">{ps.player.name}</p>
                          <p className="text-xs text-gray-500">{ps.player.position} - {ps.player.team}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${ps.points > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatPoints(ps.points)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
