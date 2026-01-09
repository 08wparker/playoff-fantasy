import { useState, useMemo } from 'react';
import type { Player, Position, RosterSlot, WeeklyRoster } from '../../types';
import { ROSTER_SLOTS } from '../../types';
import { PositionSlot } from './PositionSlot';
import { AvailablePlayers } from './AvailablePlayers';
import { ScoringRubric } from './ScoringRubric';
import { isRosterLocked, getTimeUntilLock, getLockTimeFormatted } from '../../data/players';

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
  const lockTimeFormatted = getLockTimeFormatted(currentWeek);
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

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Rankings are from Fantasy Pros and not real time. You must verify your player will start. If you want to play a player not listed, please contact LM.
        </p>
      </div>

      {/* Rules */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Rules</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>Roster:</strong> 1 QB, 2 RB, 3 WR, 1 TE, 1 D/ST, 1 K</li>
          <li>• <strong>One-time use:</strong> You can choose any player you want, but you can only use a player in ONE playoff game. For example, if you choose Josh Allen in the Wild Card round and the Bills win, you cannot play him in the Divisional round.</li>
          <li>• <strong>Changes allowed:</strong> You can change your roster as many times as you want before the lock time</li>
          <li>• <strong>Lock time:</strong> {lockTimeFormatted || 'TBD'}</li>
        </ul>
      </div>

      {/* Prize Pool */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h3 className="font-semibold text-primary-800 mb-2">Prize Pool</h3>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>• <strong>1st Place (Cumulative):</strong> 50% of pot</li>
          <li>• <strong>2nd Place (Cumulative):</strong> 20% of pot</li>
          <li>• <strong>3rd Place (Cumulative):</strong> 10% of pot</li>
          <li>• <strong>Weekly High Score:</strong> 5% of pot each week</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-primary-200">
          <p className="text-sm text-primary-700">
            <strong>Optional buy-in:</strong> $50 via Venmo or Zelle to williamfparker@gmail.com
          </p>
        </div>
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
