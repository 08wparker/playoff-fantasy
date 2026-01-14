import { useState, useEffect, useCallback } from 'react';
import { savePlayerStats, getAllPlayerStatsForWeek, getCachedPlayers, clearAllPlayerStatsForWeek } from '../../services/firebase';
import type { Player, PlayerStats, PlayoffWeekName, Position } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';

// All offensive stats for skill positions
const OFFENSIVE_STATS: (keyof Omit<PlayerStats, 'playerId' | 'week'>)[] = [
  'passingYards', 'passingTDs', 'interceptions',
  'rushingYards', 'rushingTDs',
  'receptions', 'receivingYards', 'receivingTDs',
];

// Stats by position type
const POSITION_STATS: Record<Position, (keyof Omit<PlayerStats, 'playerId' | 'week'>)[]> = {
  QB: OFFENSIVE_STATS,
  RB: OFFENSIVE_STATS,
  WR: OFFENSIVE_STATS,
  TE: OFFENSIVE_STATS,
  K: ['fg0_39', 'fg40_49', 'fg50Plus', 'fgMissed', 'xpMade', 'xpMissed'],
  DST: ['pointsAllowed', 'sacks', 'defensiveInterceptions', 'fumbleRecoveries', 'defensiveTDs'],
};

const STAT_LABELS: Record<string, string> = {
  passingYards: 'Pass Yds',
  passingTDs: 'Pass TD',
  interceptions: 'INT',
  rushingYards: 'Rush Yds',
  rushingTDs: 'Rush TD',
  receptions: 'Rec',
  receivingYards: 'Rec Yds',
  receivingTDs: 'Rec TD',
  fg0_39: 'FG 0-39',
  fg40_49: 'FG 40-49',
  fg50Plus: 'FG 50+',
  fgMissed: 'FG Miss',
  xpMade: 'XP Made',
  xpMissed: 'XP Miss',
  pointsAllowed: 'Pts Allow',
  sacks: 'Sacks',
  defensiveInterceptions: 'DEF INT',
  fumbleRecoveries: 'Fum Rec',
  defensiveTDs: 'DEF TD',
};

const WEEKS: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

function createEmptyStats(): Omit<PlayerStats, 'playerId' | 'week'> {
  return {
    passingYards: 0,
    passingTDs: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    fg0_39: 0,
    fg40_49: 0,
    fg50Plus: 0,
    fgMissed: 0,
    xpMade: 0,
    xpMissed: 0,
    pointsAllowed: 0,
    sacks: 0,
    defensiveInterceptions: 0,
    fumbleRecoveries: 0,
    defensiveTDs: 0,
  };
}

interface PlayerRowProps {
  player: Player;
  stats: Omit<PlayerStats, 'playerId' | 'week'>;
  statFields: (keyof Omit<PlayerStats, 'playerId' | 'week'>)[];
  onChange: (field: keyof Omit<PlayerStats, 'playerId' | 'week'>, value: number) => void;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

function PlayerRow({ player, stats, statFields, onChange, onSave, saving, hasChanges }: PlayerRowProps) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-3 font-medium text-sm sticky left-0 bg-white min-w-[160px]">
        {player.name}
      </td>
      {statFields.map(field => (
        <td key={field} className="py-1 px-1">
          <input
            type="number"
            value={stats[field] || 0}
            onChange={(e) => onChange(field, parseInt(e.target.value, 10) || 0)}
            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-center"
          />
        </td>
      ))}
      <td className="py-1 px-2">
        <button
          onClick={onSave}
          disabled={saving || !hasChanges}
          className={`px-3 py-1 text-xs rounded font-medium ${
            hasChanges
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {saving ? '...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

interface TeamGroupProps {
  team: string;
  players: Player[];
  statFields: (keyof Omit<PlayerStats, 'playerId' | 'week'>)[];
  playerStats: Map<string, Omit<PlayerStats, 'playerId' | 'week'>>;
  originalStats: Map<string, PlayerStats>;
  onStatChange: (playerId: string, field: keyof Omit<PlayerStats, 'playerId' | 'week'>, value: number) => void;
  onSave: (playerId: string) => void;
  savingPlayers: Set<string>;
}

function TeamGroup({ team, players, statFields, playerStats, originalStats, onStatChange, onSave, savingPlayers }: TeamGroupProps) {
  return (
    <>
      <tr className="bg-gray-100">
        <td colSpan={statFields.length + 2} className="py-2 px-3 font-bold text-sm text-gray-700">
          {team}
        </td>
      </tr>
      {players.map(player => {
        const stats = playerStats.get(player.id) || createEmptyStats();
        const original = originalStats.get(player.id);
        const hasChanges = !original || JSON.stringify(stats) !== JSON.stringify({
          ...createEmptyStats(),
          ...original,
          playerId: undefined,
          week: undefined,
        });

        return (
          <PlayerRow
            key={player.id}
            player={player}
            stats={stats}
            statFields={statFields}
            onChange={(field, value) => onStatChange(player.id, field, value)}
            onSave={() => onSave(player.id)}
            saving={savingPlayers.has(player.id)}
            hasChanges={hasChanges}
          />
        );
      })}
    </>
  );
}

export function AdminStats() {
  const [selectedWeek, setSelectedWeek] = useState<PlayoffWeekName>('wildcard');
  const [selectedPosition, setSelectedPosition] = useState<Position>('QB');
  const [players, setPlayers] = useState<Player[]>([]);
  const [originalStats, setOriginalStats] = useState<Map<string, PlayerStats>>(new Map());
  const [playerStats, setPlayerStats] = useState<Map<string, Omit<PlayerStats, 'playerId' | 'week'>>>(new Map());
  const [savingPlayers, setSavingPlayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load players and existing stats
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [fetchedPlayers, weekStats] = await Promise.all([
          getCachedPlayers(),
          getAllPlayerStatsForWeek(selectedWeek),
        ]);

        // Debug: log position breakdown
        const positionCounts = fetchedPlayers.reduce((acc, p) => {
          acc[p.position] = (acc[p.position] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Loaded players from Firebase:', fetchedPlayers.length, 'by position:', positionCounts);

        setPlayers(fetchedPlayers);

        const originalMap = new Map<string, PlayerStats>();
        const statsMap = new Map<string, Omit<PlayerStats, 'playerId' | 'week'>>();

        weekStats.forEach(s => {
          originalMap.set(s.playerId, s);
          const { playerId, week, ...rest } = s;
          statsMap.set(s.playerId, rest);
        });

        setOriginalStats(originalMap);
        setPlayerStats(statsMap);
      } catch (err) {
        console.error('Error loading data:', err);
      }
      setLoading(false);
    }
    load();
  }, [selectedWeek]);

  const handleStatChange = useCallback((
    playerId: string,
    field: keyof Omit<PlayerStats, 'playerId' | 'week'>,
    value: number
  ) => {
    setPlayerStats(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(playerId) || createEmptyStats();
      newMap.set(playerId, { ...current, [field]: value });
      return newMap;
    });
  }, []);

  const handleSave = useCallback(async (playerId: string) => {
    const stats = playerStats.get(playerId);
    if (!stats) return;

    setSavingPlayers(prev => new Set(prev).add(playerId));

    const success = await savePlayerStats(selectedWeek, playerId, stats);

    if (success) {
      const weekNumber = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 }[selectedWeek];
      setOriginalStats(prev => {
        const newMap = new Map(prev);
        newMap.set(playerId, { ...stats, playerId, week: weekNumber });
        return newMap;
      });

      const player = players.find(p => p.id === playerId);
      setMessage({ type: 'success', text: `Saved ${player?.name || 'player'}` });
    } else {
      setMessage({ type: 'error', text: 'Failed to save' });
    }

    setSavingPlayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(playerId);
      return newSet;
    });

    setTimeout(() => setMessage(null), 2000);
  }, [playerStats, selectedWeek, players]);

  // Clear all stats for the week
  const handleClearStats = useCallback(async () => {
    if (!confirm(`Are you sure you want to clear ALL stats for ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]}? This cannot be undone.`)) {
      return;
    }

    setClearing(true);
    const deleted = await clearAllPlayerStatsForWeek(selectedWeek);

    if (deleted > 0) {
      setOriginalStats(new Map());
      setPlayerStats(new Map());
      setMessage({ type: 'success', text: `Cleared ${deleted} player stats` });
    } else {
      setMessage({ type: 'error', text: 'No stats to clear or error occurred' });
    }

    setClearing(false);
    setTimeout(() => setMessage(null), 3000);
  }, [selectedWeek]);

  // Filter and group players
  const filteredPlayers = players.filter(p => p.position === selectedPosition);
  const playersByTeam = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.team]) acc[player.team] = [];
    acc[player.team].push(player);
    return acc;
  }, {} as Record<string, Player[]>);

  // Sort teams alphabetically, sort players within team by name
  const sortedTeams = Object.keys(playersByTeam).sort();
  sortedTeams.forEach(team => {
    playersByTeam[team].sort((a, b) => a.name.localeCompare(b.name));
  });

  const statFields = POSITION_STATS[selectedPosition];
  const playersWithStats = filteredPlayers.filter(p => originalStats.has(p.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Week Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {WEEKS.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                selectedWeek === week
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {PLAYOFF_WEEK_DISPLAY_NAMES[week]}
            </button>
          ))}
        </div>
      </div>

      {/* Position Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex gap-1 p-2">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedPosition === pos
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-700">
            {playersWithStats} of {filteredPlayers.length} {selectedPosition}s have stats for {PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]}
          </span>
          <button
            onClick={handleClearStats}
            disabled={clearing || playersWithStats === 0}
            className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing...' : `Clear All ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]} Stats`}
          </button>
        </div>
        {message && (
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>

      {/* Spreadsheet */}
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50 z-20">
                Player
              </th>
              {statFields.map(field => (
                <th key={field} className="py-2 px-1 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                  {STAT_LABELS[field]}
                </th>
              ))}
              <th className="py-2 px-2 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map(team => (
              <TeamGroup
                key={team}
                team={team}
                players={playersByTeam[team]}
                statFields={statFields}
                playerStats={playerStats}
                originalStats={originalStats}
                onStatChange={handleStatChange}
                onSave={handleSave}
                savingPlayers={savingPlayers}
              />
            ))}
          </tbody>
        </table>
      </div>

      {filteredPlayers.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No {selectedPosition} players found. Run the player sync first.
        </div>
      )}
    </div>
  );
}
