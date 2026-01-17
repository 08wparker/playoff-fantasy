import { useState, useMemo } from 'react';
import type { Player, Position } from '../../types';
import { PlayerCard } from './PlayerCard';

interface AvailablePlayersProps {
  players: Player[];
  position: Position;
  usedPlayerIds: string[];
  currentRosterPlayerIds: string[];
  onSelect: (player: Player) => void;
  onClose: () => void;
}

export function AvailablePlayers({
  players,
  position,
  usedPlayerIds,
  currentRosterPlayerIds,
  onSelect,
  onClose,
}: AvailablePlayersProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const usedSet = useMemo(() => new Set(usedPlayerIds), [usedPlayerIds]);
  const currentRosterSet = useMemo(
    () => new Set(currentRosterPlayerIds),
    [currentRosterPlayerIds]
  );

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    return players
      .filter((p) => p.position === position)
      .filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.team.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Sort: available first, then used
        const aUsed = usedSet.has(a.id);
        const bUsed = usedSet.has(b.id);
        if (aUsed !== bUsed) return aUsed ? 1 : -1;

        // Sort: healthy/questionable first, then "out" players at bottom
        const aOut = a.injuryStatus === 'out';
        const bOut = b.injuryStatus === 'out';
        if (aOut !== bOut) return aOut ? 1 : -1;

        // For K and DST, sort alphabetically by name
        if (position === 'K' || position === 'DST') {
          return a.name.localeCompare(b.name);
        }

        // For other positions, sort by rank (lower rank = better)
        const aRank = a.rank ?? 999;
        const bRank = b.rank ?? 999;
        return aRank - bRank;
      });
  }, [players, position, searchQuery, usedSet]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Select {position}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        {/* Player List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPlayers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No players available
            </p>
          ) : (
            filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isUsed={usedSet.has(player.id)}
                isSelected={currentRosterSet.has(player.id)}
                onClick={() => {
                  if (!usedSet.has(player.id) && !currentRosterSet.has(player.id)) {
                    onSelect(player);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
