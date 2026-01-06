import { useState, useEffect, useMemo } from 'react';
import type { User, WeeklyRoster, Player, RosterScore, PlayerScore, PlayerStats } from '../types';
import { getAllUsers, getAllRostersForWeek } from '../services/firebase';
import { fetchPlayerStats } from '../services/espnApi';
import { calculatePoints } from '../services/scoring';

interface UseScoringResult {
  standings: RosterScore[];
  loading: boolean;
  error: string | null;
  refreshScores: () => Promise<void>;
}

export function useScoring(
  week: number,
  getPlayerById: (id: string) => Player | undefined
): UseScoringResult {
  const [users, setUsers] = useState<User[]>([]);
  const [rosters, setRosters] = useState<WeeklyRoster[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount and week change
  useEffect(() => {
    loadScoreData();
  }, [week]);

  async function loadScoreData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch users and rosters in parallel
      const [usersData, rostersData] = await Promise.all([
        getAllUsers(),
        getAllRostersForWeek(week),
      ]);

      setUsers(usersData);
      setRosters(rostersData);

      // Get unique player IDs from all rosters
      const playerIds = new Set<string>();
      rostersData.forEach((roster) => {
        [roster.qb, roster.rb1, roster.rb2, roster.wr1, roster.wr2, roster.wr3, roster.te, roster.dst, roster.k]
          .filter((id): id is string => id !== null)
          .forEach((id) => playerIds.add(id));
      });

      // Fetch stats for all players
      const stats = new Map<string, PlayerStats>();
      for (const playerId of playerIds) {
        const playerStat = await fetchPlayerStats(playerId, week);
        if (playerStat) {
          stats.set(playerId, playerStat);
        }
      }

      setPlayerStats(stats);
    } catch (err) {
      setError('Failed to load scores');
      console.error('Error loading scores:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshScores() {
    await loadScoreData();
  }

  // Calculate standings
  const standings = useMemo<RosterScore[]>(() => {
    const scores: RosterScore[] = [];

    for (const roster of rosters) {
      const user = users.find((u) => u.uid === roster.odId);
      if (!user) continue;

      const playerScores: PlayerScore[] = [];
      let totalPoints = 0;

      // Calculate scores for each position
      const slots = [
        roster.qb,
        roster.rb1,
        roster.rb2,
        roster.wr1,
        roster.wr2,
        roster.wr3,
        roster.te,
        roster.dst,
        roster.k,
      ];

      for (const playerId of slots) {
        if (!playerId) continue;

        const player = getPlayerById(playerId);
        if (!player) continue;

        const stats = playerStats.get(playerId);
        const points = stats ? calculatePoints(stats) : 0;

        playerScores.push({
          player,
          stats: stats || createEmptyStats(playerId, week),
          points,
        });

        totalPoints += points;
      }

      scores.push({
        user,
        roster,
        playerScores,
        totalPoints,
      });
    }

    // Sort by total points descending
    scores.sort((a, b) => b.totalPoints - a.totalPoints);

    return scores;
  }, [users, rosters, playerStats, getPlayerById]);

  return {
    standings,
    loading,
    error,
    refreshScores,
  };
}

// Helper to create empty stats
function createEmptyStats(playerId: string, week: number): PlayerStats {
  return {
    playerId,
    week,
    passingYards: 0,
    passingTDs: 0,
    interceptions: 0,
    rushingYards: 0,
    rushingTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    fieldGoals: 0,
    extraPoints: 0,
    pointsAllowed: 0,
    sacks: 0,
    defensiveInterceptions: 0,
    fumbleRecoveries: 0,
    defensiveTDs: 0,
  };
}

// Get cumulative standings across all weeks
export function useCumulativeStandings(
  maxWeek: number,
  _getPlayerById: (id: string) => Player | undefined
): { standings: { user: User; totalPoints: number; weeklyPoints: number[] }[]; loading: boolean } {
  const [standings, setStandings] = useState<{ user: User; totalPoints: number; weeklyPoints: number[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCumulativeData() {
      setLoading(true);

      try {
        const users = await getAllUsers();
        const userStandings: Map<string, { user: User; totalPoints: number; weeklyPoints: number[] }> = new Map();

        // Initialize standings for each user
        for (const user of users) {
          userStandings.set(user.uid, {
            user,
            totalPoints: 0,
            weeklyPoints: [],
          });
        }

        // Load data for each week
        for (let week = 1; week <= maxWeek; week++) {
          const rosters = await getAllRostersForWeek(week);

          for (const roster of rosters) {
            const standing = userStandings.get(roster.odId);
            if (standing) {
              standing.weeklyPoints.push(roster.totalPoints);
              standing.totalPoints += roster.totalPoints;
            }
          }
        }

        // Convert to array and sort
        const sortedStandings = Array.from(userStandings.values()).sort(
          (a, b) => b.totalPoints - a.totalPoints
        );

        setStandings(sortedStandings);
      } catch (err) {
        console.error('Error loading cumulative standings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCumulativeData();
  }, [maxWeek]);

  return { standings, loading };
}
