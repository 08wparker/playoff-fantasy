import { useState, useEffect } from 'react';
import { getAllUsers, updateUserPaymentStatus, syncRosterToUsedPlayers, getUsedPlayers, resetUsedPlayers } from '../../services/firebase';
import type { User } from '../../types';

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ userId: string; message: string } | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userUsedPlayers, setUserUsedPlayers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const allUsers = await getAllUsers();
    setUsers(allUsers);
    setLoading(false);
  }

  const emails = users
    .map(u => u.email)
    .filter((email): email is string => !!email);

  const paidCount = users.filter(u => u.hasPaid).length;
  const totalPot = paidCount * 50;

  const handleCopyEmails = async () => {
    const emailList = emails.join(', ');
    await navigator.clipboard.writeText(emailList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePayment = async (userId: string, currentStatus: boolean) => {
    setUpdating(userId);
    const success = await updateUserPaymentStatus(userId, !currentStatus);
    if (success) {
      setUsers(users.map(u =>
        u.uid === userId ? { ...u, hasPaid: !currentStatus } : u
      ));
    }
    setUpdating(null);
  };

  const handleSyncUsedPlayers = async (userId: string, week: number) => {
    setSyncing(userId);
    setSyncMessage(null);
    const result = await syncRosterToUsedPlayers(userId, week);
    if (result.success) {
      setSyncMessage({ userId, message: `Synced ${result.playerIds.length} players from week ${week}` });
      // Refresh the user's used players
      const usedPlayers = await getUsedPlayers(userId);
      setUserUsedPlayers(prev => ({ ...prev, [userId]: usedPlayers }));
    } else {
      setSyncMessage({ userId, message: `Failed to sync week ${week} roster` });
    }
    setSyncing(null);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const handleExpandUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!userUsedPlayers[userId]) {
      const usedPlayers = await getUsedPlayers(userId);
      setUserUsedPlayers(prev => ({ ...prev, [userId]: usedPlayers }));
    }
  };

  const handleResetUsedPlayers = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s usedPlayers? This will allow them to re-select previously used players.')) {
      return;
    }
    setSyncing(userId);
    const success = await resetUsedPlayers(userId);
    if (success) {
      setSyncMessage({ userId, message: 'Reset usedPlayers to empty' });
      setUserUsedPlayers(prev => ({ ...prev, [userId]: [] }));
    } else {
      setSyncMessage({ userId, message: 'Failed to reset usedPlayers' });
    }
    setSyncing(null);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Registered Users</h2>
        <div className="text-right">
          <span className="text-sm text-gray-500">{users.length} users</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm font-medium text-green-600">{paidCount} paid (${totalPot} pot)</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Email list for copying */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">All Emails ({emails.length})</span>
            <button
              onClick={handleCopyEmails}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {copied ? 'Copied!' : 'Copy All'}
            </button>
          </div>
          <p className="text-sm text-gray-600 break-all">
            {emails.join(', ') || 'No emails found'}
          </p>
        </div>

        {/* User list */}
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          {users.map(user => (
            <div key={user.uid}>
              <div className="p-3 flex items-center gap-3">
                <button
                  onClick={() => handleExpandUser(user.uid)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-4 h-4 transition-transform ${expandedUser === user.uid ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
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
                <button
                  onClick={() => handleTogglePayment(user.uid, !!user.hasPaid)}
                  disabled={updating === user.uid}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    user.hasPaid
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {updating === user.uid ? '...' : user.hasPaid ? 'Paid ✓' : 'Not Paid'}
                </button>
              </div>
              {/* Expanded section */}
              {expandedUser === user.uid && (
                <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                  <div className="pt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      UID: <code className="bg-gray-200 px-1 rounded">{user.uid}</code>
                    </p>
                    <p className="text-xs text-gray-500">
                      Used Players: {userUsedPlayers[user.uid]?.length ?? 'Loading...'}
                    </p>
                    {userUsedPlayers[user.uid] && userUsedPlayers[user.uid].length > 0 && (
                      <p className="text-xs text-gray-400 break-all">
                        IDs: {userUsedPlayers[user.uid].join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="text-xs text-gray-600 font-medium">Sync roster to usedPlayers:</span>
                      {[1, 2, 3, 4].map(week => (
                        <button
                          key={week}
                          onClick={() => handleSyncUsedPlayers(user.uid, week)}
                          disabled={syncing === user.uid}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        >
                          {syncing === user.uid ? '...' : `Wk ${week}`}
                        </button>
                      ))}
                      <button
                        onClick={() => handleResetUsedPlayers(user.uid)}
                        disabled={syncing === user.uid}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        {syncing === user.uid ? '...' : 'Reset'}
                      </button>
                    </div>
                    {syncMessage?.userId === user.uid && (
                      <p className="text-xs text-green-600 font-medium">{syncMessage.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
