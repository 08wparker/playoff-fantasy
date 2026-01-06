import { useState, useEffect, useMemo } from 'react';
import type { Player, Position } from '../types';
import { PLAYOFF_TEAMS, WEEK_CSV_FILES } from '../data/players';
import { getCachedPlayers } from '../services/firebase';

interface UsePlayersResult {
  players: Player[];
  loading: boolean;
  error: string | null;
  getPlayerById: (id: string) => Player | undefined;
  getPlayersByPosition: (position: Position) => Player[];
  getAvailablePlayers: (position: Position, usedPlayerIds: string[]) => Player[];
  refreshPlayers: () => Promise<void>;
}

// Parse CSV text into Player objects
function parseCSV(csvText: string): Player[] {
  const lines = csvText.trim().split('\n');
  const players: Player[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV parsing (simple - assumes no commas in values)
    const parts = line.split(',');
    if (parts.length >= 4) {
      const name = parts[0].trim();
      const position = parts[1].trim() as Position;
      const team = parts[2].trim();
      const rank = parseInt(parts[3].trim(), 10) || undefined;

      // Create a unique ID from name and position
      const id = `${position.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      players.push({
        id,
        name,
        position,
        team: team as any,
        rank,
      });
    }
  }

  return players;
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
      // Get the CSV file for this week (default to wildcard)
      const csvPath = WEEK_CSV_FILES[week] || WEEK_CSV_FILES[1];

      // Fetch the CSV file and Firebase cached players in parallel
      const [csvResponse, firebasePlayers] = await Promise.all([
        fetch(csvPath),
        getCachedPlayers(),
      ]);

      if (!csvResponse.ok) {
        throw new Error(`Failed to load player data: ${csvResponse.status}`);
      }

      const csvText = await csvResponse.text();
      const allPlayers = parseCSV(csvText);

      // Create a map of Firebase players by name for image lookup
      const firebasePlayerMap = new Map<string, Player>();
      firebasePlayers.forEach((p) => {
        firebasePlayerMap.set(p.name.toLowerCase(), p);
      });

      // Filter players to only include those on playoff teams
      // and merge with Firebase data for imageUrls
      const playoffPlayers = allPlayers
        .filter(p => PLAYOFF_TEAMS.includes(p.team as any))
        .map(p => {
          const firebasePlayer = firebasePlayerMap.get(p.name.toLowerCase());
          return {
            ...p,
            imageUrl: firebasePlayer?.imageUrl || p.imageUrl,
          };
        });

      setPlayers(playoffPlayers);
    } catch (err) {
      setError('Failed to load players. Make sure the CSV file exists.');
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
