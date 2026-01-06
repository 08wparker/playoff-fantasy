import type { Player, PlayerStats as PlayerStatsType } from '../../types';
import { formatPoints, getScoringBreakdown } from '../../services/scoring';

interface PlayerStatsProps {
  player: Player;
  stats: PlayerStatsType;
  points: number;
}

export function PlayerStats({ player, stats, points }: PlayerStatsProps) {
  const breakdown = getScoringBreakdown(stats);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      {/* Player Image */}
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm">
            {player.position === 'DST' ? '🛡️' : '👤'}
          </span>
        )}
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {player.name}
        </p>
        <p className="text-xs text-gray-500">
          {player.team} • {player.position}
        </p>
      </div>

      {/* Points */}
      <div className="text-right">
        <p className="font-bold text-gray-900">{formatPoints(points)}</p>
        {breakdown.length > 0 && (
          <div className="group relative">
            <button className="text-xs text-gray-400 hover:text-gray-600">
              Details
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 hidden group-hover:block z-10">
              {breakdown.map((line, i) => (
                <p key={i} className="py-0.5">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
