import type { Player } from '../../types';

interface PlayerCardProps {
  player: Player;
  isSelected?: boolean;
  isUsed?: boolean;
  onClick?: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
  compact?: boolean;
}

export function PlayerCard({
  player,
  isSelected = false,
  isUsed = false,
  onClick,
  showRemove = false,
  onRemove,
  compact = false,
}: PlayerCardProps) {
  const baseClasses = compact
    ? 'flex items-center gap-2 p-2 rounded-lg transition-all'
    : 'flex items-center gap-3 p-3 rounded-lg transition-all';

  const stateClasses = isUsed
    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
    : isSelected
    ? 'bg-primary-100 border-2 border-primary-500'
    : onClick
    ? 'bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md cursor-pointer'
    : 'bg-white border border-gray-200';

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      onClick={!isUsed && onClick ? onClick : undefined}
    >
      {/* Player Image */}
      <div
        className={`${
          compact ? 'w-8 h-8' : 'w-12 h-12'
        } rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0`}
      >
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={compact ? 'text-sm' : 'text-lg'}>
            {player.position === 'DST' ? '🛡️' : '👤'}
          </span>
        )}
      </div>

      {/* Rank Badge (for QB, RB, WR, TE only) */}
      {player.rank && player.position !== 'K' && player.position !== 'DST' && (
        <div
          className={`${
            compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
          } rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center flex-shrink-0`}
        >
          {player.rank}
        </div>
      )}

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`font-medium truncate ${
              compact ? 'text-sm' : ''
            } ${isUsed ? 'text-gray-400' : 'text-gray-900'}`}
          >
            {player.name}
          </p>
          {/* Injury Status Badge */}
          {player.injuryStatus && (
            <span
              className={`inline-flex px-1.5 py-0.5 text-xs font-bold rounded ${
                player.injuryStatus === 'out'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {player.injuryStatus === 'out' ? 'OUT' : 'Q'}
            </span>
          )}
        </div>
        <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
          {player.team} • {player.position}
        </p>
      </div>

      {/* Used Badge or Remove Button */}
      {isUsed && (
        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded">
          Used
        </span>
      )}

      {showRemove && onRemove && !isUsed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg
            className="w-5 h-5"
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
      )}
    </div>
  );
}
