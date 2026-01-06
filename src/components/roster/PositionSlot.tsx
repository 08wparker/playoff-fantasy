import type { Player, Position } from '../../types';
import { PlayerCard } from './PlayerCard';

interface PositionSlotProps {
  label: string;
  position: Position;
  selectedPlayer: Player | null;
  isLocked: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function PositionSlot({
  label,
  position,
  selectedPlayer,
  isLocked,
  onSelect,
  onRemove,
}: PositionSlotProps) {
  if (selectedPlayer) {
    return (
      <div className="relative">
        <div className="absolute -top-2 -left-2 bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded z-10">
          {label}
        </div>
        <PlayerCard
          player={selectedPlayer}
          showRemove={!isLocked}
          onRemove={onRemove}
        />
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      disabled={isLocked}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-all ${
        isLocked
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-2xl text-gray-400">+</span>
      </div>
      <div className="text-left">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">Select {position}</p>
      </div>
    </button>
  );
}
