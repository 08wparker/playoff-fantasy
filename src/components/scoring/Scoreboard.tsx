import { useState } from 'react';
import type { RosterScore } from '../../types';
import { formatPoints } from '../../services/scoring';
import { PlayerStats } from './PlayerStats';

interface ScoreboardProps {
  standings: RosterScore[];
  loading: boolean;
  error: string | null;
  currentWeek: number;
  onRefresh: () => Promise<void>;
}

export function Scoreboard({
  standings,
  loading,
  error,
  currentWeek,
  onRefresh,
}: ScoreboardProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No rosters submitted yet</p>
        <p className="text-gray-400 text-sm mt-2">
          Check back once players have locked their rosters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Week {currentWeek} Standings
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Scores'}
        </button>
      </div>

      {/* Standings List */}
      <div className="space-y-3">
        {standings.map((entry, index) => (
          <div
            key={entry.user.uid}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* User Header */}
            <button
              onClick={() =>
                setExpandedUser(
                  expandedUser === entry.user.uid ? null : entry.user.uid
                )
              }
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : index === 1
                    ? 'bg-gray-100 text-gray-600'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                {index + 1}
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 flex-1">
                {entry.user.photoURL && (
                  <img
                    src={entry.user.photoURL}
                    alt={entry.user.displayName || 'User'}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">
                    {entry.user.displayName || 'Anonymous'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.roster.locked ? '🔒 Locked' : '⏳ Not locked'}
                  </p>
                </div>
              </div>

              {/* Total Points */}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatPoints(entry.totalPoints)}
                </p>
                <p className="text-xs text-gray-500">points</p>
              </div>

              {/* Expand Icon */}
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedUser === entry.user.uid ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Expanded Player Details */}
            {expandedUser === entry.user.uid && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Roster Breakdown
                </h4>
                <div className="space-y-1">
                  {entry.playerScores.map((ps) => (
                    <PlayerStats
                      key={ps.player.id}
                      player={ps.player}
                      stats={ps.stats}
                      points={ps.points}
                    />
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
