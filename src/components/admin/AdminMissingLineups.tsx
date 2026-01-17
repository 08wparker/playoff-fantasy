import { useState, useEffect } from 'react';
import { getAllUsers, getRoster } from '../../services/firebase';
import type { User } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';

interface UserWithRosterStatus {
  user: User;
  hasRoster: boolean;
}

export function AdminMissingLineups() {
  const [selectedWeek, setSelectedWeek] = useState(2); // Default to divisional round
  const [usersStatus, setUsersStatus] = useState<UserWithRosterStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadUsersWithRosterStatus();
  }, [selectedWeek]);

  async function loadUsersWithRosterStatus() {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();

      // Check each user for a roster in the selected week
      const statusPromises = allUsers.map(async (user) => {
        const roster = await getRoster(user.uid, selectedWeek);
        return {
          user,
          hasRoster: roster !== null,
        };
      });

      const results = await Promise.all(statusPromises);
      setUsersStatus(results);
    } catch (error) {
      console.error('Error loading users with roster status:', error);
    } finally {
      setLoading(false);
    }
  }

  const missingUsers = usersStatus.filter(us => !us.hasRoster);
  const submittedUsers = usersStatus.filter(us => us.hasRoster);
  const missingEmails = missingUsers
    .map(us => us.user.email)
    .filter((email): email is string => !!email);

  const handleCopyEmails = async () => {
    const emailList = missingEmails.join(', ');
    await navigator.clipboard.writeText(emailList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const weekName = { 1: 'wildcard', 2: 'divisional', 3: 'championship', 4: 'superbowl' }[selectedWeek] as keyof typeof PLAYOFF_WEEK_DISPLAY_NAMES;
  const weekDisplayName = PLAYOFF_WEEK_DISPLAY_NAMES[weekName];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Missing Lineups</h2>
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Missing Lineups</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={1}>Wild Card</option>
            <option value={2}>Divisional</option>
            <option value={3}>Championship</option>
            <option value={4}>Super Bowl</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-4 text-sm mb-2">
          <span className="text-gray-600">
            <span className="font-semibold text-red-600">{missingUsers.length}</span> missing
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">
            <span className="font-semibold text-green-600">{submittedUsers.length}</span> submitted
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">
            <span className="font-semibold">{usersStatus.length}</span> total users
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Checking {weekDisplayName} lineups (Week {selectedWeek})
        </p>
      </div>

      {missingUsers.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700 font-medium">
            All users have submitted their lineups for {weekDisplayName}!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Email list for copying */}
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-900">
                Missing Users' Emails ({missingEmails.length})
              </span>
              <button
                onClick={handleCopyEmails}
                className="text-sm text-red-700 hover:text-red-800 font-medium px-3 py-1 bg-white rounded border border-red-300 hover:bg-red-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            </div>
            <p className="text-sm text-red-800 break-all">
              {missingEmails.join(', ') || 'No emails found'}
            </p>
          </div>

          {/* User list */}
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {missingUsers.map(({ user }) => (
              <div key={user.uid} className="p-3 flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                    {user.displayName?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || 'Anonymous'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email || 'No email'}</p>
                </div>
                <div className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                  No Lineup
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
