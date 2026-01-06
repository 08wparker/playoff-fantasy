import { useState, useEffect, useMemo } from 'react';
import type { Player, Position, PlayoffWeekName } from '../types';
import { PLAYOFF_WEEK_NAMES } from '../types';
import { getCachedPlayers, getPlayoffConfig, getPlayerRanks } from '../services/firebase';

interface UsePlayersResult {
  players: Player[];
  loading: boolean;
  error: string | null;
  getPlayerById: (id: string) => Player | undefined;
  getPlayersByPosition: (position: Position) => Player[];
  getAvailablePlayers: (position: Position, usedPlayerIds: string[]) => Player[];
  refreshPlayers: () => Promise<void>;
}

export function usePlayers(week: number): UsePlayersResult {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create a map for quick lookups
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  // Load players on mount and when week changes
  useEffect(() => {
    loadPlayers();
  }, [week]);

  async function loadPlayers() {
    setLoading(true);
    setError(null);

    try {
      // Get week name from week number
      const weekName = PLAYOFF_WEEK_NAMES[week] as PlayoffWeekName;
      if (!weekName) {
        throw new Error(`Invalid week number: ${week}`);
      }

      // Load playoff config (teams), players, and ranks from Firebase in parallel
      const [teams, allPlayers, ranks] = await Promise.all([
        getPlayoffConfig(weekName),
        getCachedPlayers(),
        getPlayerRanks(weekName),
      ]);

      console.log(`Loaded for ${weekName}: ${teams.length} teams, ${allPlayers.length} players, ${ranks.size} ranks`);

      if (teams.length === 0) {
        console.warn(`No teams configured for ${weekName}. Run the sync for this week first.`);
      }

      // Filter players to only include those on active teams for this week
      // and add their rank for this week
      const teamsSet = new Set(teams);
      const playoffPlayers = allPlayers
        .filter(p => teamsSet.has(p.team))
        .map(p => ({
          ...p,
          rank: ranks.get(p.id),
        }));

      console.log(`Filtered to ${playoffPlayers.length} players on active teams`);

      setPlayers(playoffPlayers);
    } catch (err) {
      setError('Failed to load players. Make sure you\'ve run the sync for this week.');
      console.error('Error loading players:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlayers() {
    await loadPlayers();
  }

  function getPlayerById(id: string): Player | undefined {
    return playerMap.get(id);
  }

  function getPlayersByPosition(position: Position): Player[] {
    return players.filter((p) => p.position === position);
  }

  function getAvailablePlayers(position: Position, usedPlayerIds: string[]): Player[] {
    const usedSet = new Set(usedPlayerIds);
    return players.filter(
      (p) => p.position === position && !usedSet.has(p.id)
    );
  }

  return {
    players,
    loading,
    error,
    getPlayerById,
    getPlayersByPosition,
    getAvailablePlayers,
    refreshPlayers,
  };
}
