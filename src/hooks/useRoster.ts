import { useState, useEffect, useCallback } from 'react';
import type { WeeklyRoster, RosterSlot } from '../types';
import {
  saveRoster,
  getUsedPlayers,
  addUsedPlayers,
  subscribeToRoster,
} from '../services/firebase';

interface UseRosterResult {
  roster: WeeklyRoster | null;
  usedPlayers: string[];
  loading: boolean;
  error: string | null;
  setPlayerForSlot: (slot: RosterSlot, playerId: string | null) => void;
  saveCurrentRoster: () => Promise<boolean>;
  lockCurrentRoster: () => Promise<boolean>;
}

const createEmptyRoster = (userId: string, week: number): WeeklyRoster => ({
  odId: userId,
  week,
  qb: null,
  rb1: null,
  rb2: null,
  wr1: null,
  wr2: null,
  wr3: null,
  te: null,
  dst: null,
  k: null,
  locked: false,
  totalPoints: 0,
});

export function useRoster(userId: string | null, week: number): UseRosterResult {
  const [roster, setRoster] = useState<WeeklyRoster | null>(null);
  const [usedPlayers, setUsedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load roster and used players
  useEffect(() => {
    if (!userId) {
      setRoster(null);
      setUsedPlayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time roster updates
    const unsubscribe = subscribeToRoster(userId, week, (rosterData) => {
      if (rosterData) {
        setRoster(rosterData);
      } else {
        setRoster(createEmptyRoster(userId, week));
      }
    });

    // Fetch used players
    getUsedPlayers(userId).then((players) => {
      setUsedPlayers(players);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, week]);

  // Update a single slot
  const setPlayerForSlot = useCallback((slot: RosterSlot, playerId: string | null) => {
    setRoster((current) => {
      if (!current) return current;
      if (current.locked) {
        setError('Roster is locked');
        return current;
      }
      return {
        ...current,
        [slot]: playerId,
      };
    });
  }, []);

  // Save roster to Firestore
  const saveCurrentRoster = useCallback(async (): Promise<boolean> => {
    if (!roster || !userId) {
      setError('No roster to save');
      return false;
    }

    if (roster.locked) {
      setError('Roster is locked');
      return false;
    }

    setError(null);
    const success = await saveRoster(roster);

    if (!success) {
      setError('Failed to save roster');
    }

    return success;
  }, [roster, userId]);

  // Lock roster and mark players as used
  const lockCurrentRoster = useCallback(async (): Promise<boolean> => {
    if (!roster || !userId) {
      setError('No roster to lock');
      return false;
    }

    if (roster.locked) {
      setError('Roster is already locked');
      return false;
    }

    // Get all selected player IDs
    const selectedPlayerIds = [
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

    // Check if all slots are filled
    if (selectedPlayerIds.length !== 9) {
      setError('All roster slots must be filled before locking');
      return false;
    }

    // Save roster with locked = true
    const lockedRoster = { ...roster, locked: true };
    const saveSuccess = await saveRoster(lockedRoster);

    if (!saveSuccess) {
      setError('Failed to lock roster');
      return false;
    }

    // Add players to used list
    const usedSuccess = await addUsedPlayers(userId, selectedPlayerIds);

    if (!usedSuccess) {
      setError('Roster locked but failed to update used players');
      return true; // Roster is still locked
    }

    // Update local state
    setRoster(lockedRoster);
    setUsedPlayers((current) => [...current, ...selectedPlayerIds]);

    return true;
  }, [roster, userId]);

  return {
    roster,
    usedPlayers,
    loading,
    error,
    setPlayerForSlot,
    saveCurrentRoster,
    lockCurrentRoster,
  };
}
