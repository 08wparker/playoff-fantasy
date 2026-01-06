import { useState, useMemo } from 'react';
import type { Player, Position, RosterSlot, WeeklyRoster } from '../../types';
import { ROSTER_SLOTS } from '../../types';
import { PositionSlot } from './PositionSlot';
import { AvailablePlayers } from './AvailablePlayers';
import { ScoringRubric } from './ScoringRubric';
import { isRosterLocked, getTimeUntilLock } from '../../data/players';

interface RosterBuilderProps {
  roster: WeeklyRoster | null;
  players: Player[];
  usedPlayers: string[];
  loading: boolean;
  error: string | null;
  currentWeek: number;
  getPlayerById: (id: string) => Player | undefined;
  onSetPlayer: (slot: RosterSlot, playerId: string | null) => void;
  onSave: () => Promise<boolean>;
}

export function RosterBuilder({
  roster,
  players,
  usedPlayers,
  loading,
  error,
  currentWeek,
  getPlayerById,
  onSetPlayer,
  onSave,
}: RosterBuilderProps) {
  const [selectingSlot, setSelectingSlot] = useState<{
    slot: RosterSlot;
    position: Position;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if roster is locked by time
  const isTimeLocked = isRosterLocked(currentWeek);
  const lockTimeDisplay = getTimeUntilLock(currentWeek);
  const isLocked = isTimeLocked || roster?.locked;

  // Get current roster player IDs
  const currentRosterPlayerIds = useMemo(() => {
    if (!roster) return [];
    return [
      roster.qb,
      roster.rb1,
      roster.rb2,
      roster.wr1,
      roster.wr2,
      roster.wr3,
      roster.te,
      roster.dst,
      roster.k,
    ].filter((id): id is string => id !== null);
  }, [roster]);

  const handleSelectPlayer = (player: Player) => {
    if (selectingSlot) {
      onSetPlayer(selectingSlot.slot, player.id);
      setSelectingSlot(null);
    }
  };

  const handleSave = async () => {
    if (isLocked) {
      setMessage({ type: 'error', text: 'Roster is locked and cannot be modified' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const success = await onSave();
    setSaving(false);
    setMessage({
      type: success ? 'success' : 'error',
      text: success ? 'Roster saved!' : 'Failed to save roster',
    });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {(error || message) && (
        <div
          className={`p-4 rounded-lg ${
            error || message?.type === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {error || message?.text}
        </div>
      )}

      {/* Lock Status Banner */}
      {isLocked ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-medium text-yellow-800">Roster Locked</p>
            <p className="text-sm text-yellow-600">
              Your roster is locked for this week. Check the scoreboard for results!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="font-medium text-blue-800">{lockTimeDisplay}</p>
            <p className="text-sm text-blue-600">
              Make sure to save your roster before the deadline!
            </p>
          </div>
        </div>
      )}

      {/* Roster Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROSTER_SLOTS.map(({ slot, position, label }) => {
          const playerId = roster?.[slot] || null;
          const player = playerId ? getPlayerById(playerId) : null;

          return (
            <PositionSlot
              key={slot}
              label={label}
              position={position}
              selectedPlayer={player || null}
              isLocked={isLocked || false}
              onSelect={() => setSelectingSlot({ slot, position })}
              onRemove={() => onSetPlayer(slot, null)}
            />
          );
        })}
      </div>

      {/* Actions */}
      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Roster'}
        </button>
      )}

      {/* Rules */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
        <h3 className="font-semibold text-gray-800 mb-2">Rules</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Roster: 1 QB, 2 RB, 3 WR, 1 TE, 1 D/ST, 1 K</li>
          <li>• Each player can only be used <strong>once</strong> during the entire playoffs</li>
          <li>• Rosters lock automatically at the deadline each week</li>
          <li>• Most total points at the end of the playoffs wins!</li>
        </ul>
      </div>

      {/* Scoring Rubric */}
      <ScoringRubric />

      {/* Player Selection Modal */}
      {selectingSlot && (
        <AvailablePlayers
          players={players}
          position={selectingSlot.position}
          usedPlayerIds={usedPlayers}
          currentRosterPlayerIds={currentRosterPlayerIds}
          onSelect={handleSelectPlayer}
          onClose={() => setSelectingSlot(null)}
        />
      )}
    </div>
  );
}
