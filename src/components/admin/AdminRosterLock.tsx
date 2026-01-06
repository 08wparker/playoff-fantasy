import { useState } from 'react';
import { lockAllRostersForWeek, getAllRostersForWeek } from '../../services/firebase';
import { getPlayoffWeekName } from '../../services/espnApi';
import { useCurrentWeek } from '../../hooks/useCurrentWeek';

export function AdminRosterLock() {
  const { week } = useCurrentWeek();
  const [locking, setLocking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ total: number; locked: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const rosters = await getAllRostersForWeek(week);
      const locked = rosters.filter(r => r.locked).length;
      setStatus({ total: rosters.length, locked });
    } catch (error) {
      console.error('Error checking status:', error);
    }
    setChecking(false);
  };

  const handleLockAll = async () => {
    if (!confirm(`Are you sure you want to lock all rosters for ${getPlayoffWeekName(week)}? This cannot be undone.`)) {
      return;
    }

    setLocking(true);
    setMessage(null);

    try {
      const results = await lockAllRostersForWeek(week);
      setMessage({
        type: results.errors > 0 ? 'error' : 'success',
        text: `Locked ${results.locked} rosters${results.errors > 0 ? `, ${results.errors} errors` : ''}`,
      });
      // Refresh status
      await checkStatus();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to lock rosters' });
    }

    setLocking(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Roster Lock</h2>
        {message && (
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Lock all rosters for <span className="font-medium">{getPlayoffWeekName(week)}</span>.
        This marks all players as "used" and prevents further roster changes.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={checkStatus}
          disabled={checking}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Check Status'}
        </button>

        <button
          onClick={handleLockAll}
          disabled={locking}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {locking ? 'Locking...' : 'Lock All Rosters'}
        </button>

        {status && (
          <span className="text-sm text-gray-600">
            {status.locked} of {status.total} rosters locked
          </span>
        )}
      </div>
    </div>
  );
}
