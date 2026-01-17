import { useState, useEffect, useMemo } from 'react';
import { getCachedPlayers, setPlayerInjuryStatus, clearAllInjuryStatuses } from '../../services/firebase';
import type { Player, InjuryStatus, Position } from '../../types';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

export function AdminInjuryReport() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<Position | 'all'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load players
  useEffect(() => {
    async function load() {
      setLoading(true);
      const fetched = await getCachedPlayers();
      setPlayers(fetched);
      setLoading(false);
    }
    load();
  }, []);

  // Filter players
  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => {
        const matchesSearch = search === '' ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.team.toLowerCase().includes(search.toLowerCase());
        const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
        return matchesSearch && matchesPosition;
      })
      .sort((a, b) => {
        // Injured players first, then by name
        if (a.injuryStatus && !b.injuryStatus) return -1;
        if (!a.injuryStatus && b.injuryStatus) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [players, search, positionFilter]);

  // Players with injury status
  const injuredPlayers = useMemo(() => {
    return players.filter(p => p.injuryStatus);
  }, [players]);

  const handleSetStatus = async (player: Player, status: InjuryStatus | null) => {
    setSaving(player.id);
    setMessage(null);

    const success = await setPlayerInjuryStatus(player.id, status);

    if (success) {
      // Update local state
      setPlayers(prev => prev.map(p =>
        p.id === player.id
          ? { ...p, injuryStatus: status || undefined }
          : p
      ));
      setMessage({
        type: 'success',
        text: status ? `${player.name} marked as ${status}` : `${player.name} cleared`
      });
    } else {
      setMessage({ type: 'error', text: 'Failed to update injury status' });
    }

    setSaving(null);
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all injury statuses?')) return;

    setSaving('all');
    const cleared = await clearAllInjuryStatuses();

    // Refresh players
    const fetched = await getCachedPlayers();
    setPlayers(fetched);

    setMessage({ type: 'success', text: `Cleared ${cleared} injury statuses` });
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Injury Report</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Injury Report</h2>
        {message && (
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Mark players as questionable or out. This will display an indicator on player selection.
      </p>

      {/* Current Injuries Summary */}
      {injuredPlayers.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-red-800">Current Injuries ({injuredPlayers.length})</h3>
            <button
              onClick={handleClearAll}
              disabled={saving === 'all'}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              {saving === 'all' ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {injuredPlayers.map(player => (
              <div
                key={player.id}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  player.injuryStatus === 'out'
                    ? 'bg-red-200 text-red-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}
              >
                <span className="font-medium">{player.name}</span>
                <span className="text-xs uppercase">({player.injuryStatus})</span>
                <button
                  onClick={() => handleSetStatus(player, null)}
                  disabled={saving === player.id}
                  className="ml-1 hover:opacity-70"
                  title="Clear"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value as Position | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Positions</option>
          {POSITIONS.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </div>

      {/* Player List */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Player</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Pos</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Team</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPlayers.slice(0, 50).map(player => (
              <tr
                key={player.id}
                className={player.injuryStatus ? 'bg-red-50' : 'hover:bg-gray-50'}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {player.imageUrl && (
                      <img src={player.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <span className="font-medium text-gray-900">{player.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{player.position}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{player.team}</td>
                <td className="px-4 py-2">
                  {player.injuryStatus && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      player.injuryStatus === 'out'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {player.injuryStatus.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleSetStatus(player, 'questionable')}
                      disabled={saving === player.id}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        player.injuryStatus === 'questionable'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                    >
                      Q
                    </button>
                    <button
                      onClick={() => handleSetStatus(player, 'out')}
                      disabled={saving === player.id}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        player.injuryStatus === 'out'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      OUT
                    </button>
                    {player.injuryStatus && (
                      <button
                        onClick={() => handleSetStatus(player, null)}
                        disabled={saving === player.id}
                        className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPlayers.length > 50 && (
          <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 text-center">
            Showing 50 of {filteredPlayers.length} players. Use search to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}
