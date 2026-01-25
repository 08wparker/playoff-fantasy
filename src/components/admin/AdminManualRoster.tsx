import { useState, useEffect } from 'react';
import { getAllUsers, getCachedPlayers, saveRoster, addUsedPlayers } from '../../services/firebase';
import type { User, Player, WeeklyRoster } from '../../types';

const CURRENT_WEEK = 3; // Championship week

export function AdminManualRoster() {
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [roster, setRoster] = useState({
    qb: '',
    rb1: '',
    rb2: '',
    wr1: '',
    wr2: '',
    wr3: '',
    te: '',
    dst: '',
    k: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [fetchedUsers, fetchedPlayers] = await Promise.all([
        getAllUsers(),
        getCachedPlayers(),
      ]);
      setUsers(fetchedUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
      setPlayers(fetchedPlayers);
      setLoading(false);
    }
    loadData();
  }, []);

  // Filter players by position
  const getPlayersByPosition = (pos: string) => {
    return players
      .filter(p => p.position === pos)
      .sort((a, b) => (a.rank || 99) - (b.rank || 99));
  };

  const handleSave = async () => {
    if (!selectedUser) {
      setMessage({ type: 'error', text: 'Please select a user' });
      return;
    }

    // Validate all positions are filled
    const slots = Object.entries(roster);
    const emptySlots = slots.filter(([_, value]) => !value);
    if (emptySlots.length > 0) {
      setMessage({ type: 'error', text: `Missing: ${emptySlots.map(([k]) => k.toUpperCase()).join(', ')}` });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const weeklyRoster: WeeklyRoster = {
        odId: selectedUser,
        week: CURRENT_WEEK,
        qb: roster.qb,
        rb1: roster.rb1,
        rb2: roster.rb2,
        wr1: roster.wr1,
        wr2: roster.wr2,
        wr3: roster.wr3,
        te: roster.te,
        dst: roster.dst,
        k: roster.k,
        locked: true, // Auto-lock since it's past deadline
        totalPoints: 0,
      };

      const success = await saveRoster(weeklyRoster);
      if (success) {
        // Also add players to used list
        const playerIds = Object.values(roster).filter(Boolean);
        await addUsedPlayers(selectedUser, playerIds);

        const userName = users.find(u => u.uid === selectedUser)?.displayName || 'Unknown';
        setMessage({ type: 'success', text: `Roster saved for ${userName}!` });

        // Reset form
        setRoster({ qb: '', rb1: '', rb2: '', wr1: '', wr2: '', wr3: '', te: '', dst: '', k: '' });
        setSelectedUser('');
      } else {
        setMessage({ type: 'error', text: 'Failed to save roster' });
      }
    } catch (err) {
      console.error('Error saving manual roster:', err);
      setMessage({ type: 'error', text: 'Error saving roster' });
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-lg shadow-md">Loading...</div>;
  }

  const renderPlayerSelect = (position: string, slot: keyof typeof roster, label: string) => {
    const posPlayers = getPlayersByPosition(position);
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
          value={roster[slot]}
          onChange={(e) => setRoster({ ...roster, [slot]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select {label}</option>
          {posPlayers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.team}) - Rank #{p.rank || '?'}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Manual Roster Entry (Week {CURRENT_WEEK})</h2>
      <p className="text-sm text-gray-600 mb-4">
        Add rosters for users who missed the deadline. Rosters will be auto-locked.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* User Select */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select User</option>
          {users.map(u => (
            <option key={u.uid} value={u.uid}>
              {u.displayName || u.email}
            </option>
          ))}
        </select>
      </div>

      {/* Roster Slots */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {renderPlayerSelect('QB', 'qb', 'QB')}
        {renderPlayerSelect('RB', 'rb1', 'RB1')}
        {renderPlayerSelect('RB', 'rb2', 'RB2')}
        {renderPlayerSelect('WR', 'wr1', 'WR1')}
        {renderPlayerSelect('WR', 'wr2', 'WR2')}
        {renderPlayerSelect('WR', 'wr3', 'WR3')}
        {renderPlayerSelect('TE', 'te', 'TE')}
        {renderPlayerSelect('DST', 'dst', 'D/ST')}
        {renderPlayerSelect('K', 'k', 'K')}
      </div>

      {/* Summary */}
      {selectedUser && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Roster Summary:</h4>
          <div className="text-sm text-gray-600">
            {Object.entries(roster).map(([slot, playerId]) => {
              const player = players.find(p => p.id === playerId);
              return (
                <div key={slot}>
                  <span className="font-medium">{slot.toUpperCase()}:</span>{' '}
                  {player ? `${player.name} (${player.team})` : '-'}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !selectedUser}
        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 font-medium"
      >
        {saving ? 'Saving...' : 'Save Roster'}
      </button>
    </div>
  );
}
