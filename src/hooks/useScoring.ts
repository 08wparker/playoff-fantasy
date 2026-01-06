import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, WeeklyRoster, Player, RosterScore, PlayerScore, PlayerStats, PlayoffWeekName } from '../types';
import { PLAYOFF_WEEK_NAMES, PLAYOFF_WEEK_DISPLAY_NAMES } from '../types';
import { getAllUsers, getAllRostersForWeek, getAllPlayerStatsForWeek } from '../services/firebase';
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

  const loadScoreData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const weekName = PLAYOFF_WEEK_NAMES[week] as PlayoffWeekName;
      if (!weekName) {
        throw new Error(`Invalid week number: ${week}`);
      }

      // Fetch users, rosters, and player stats from Firebase in parallel
      const [usersData, rostersData, statsData] = await Promise.all([
        getAllUsers(),
        getAllRostersForWeek(week),
        getAllPlayerStatsForWeek(weekName),
      ]);

      console.log(`Loaded scores for ${weekName}: ${usersData.length} users, ${rostersData.length} rosters, ${statsData.length} player stats`);

      setUsers(usersData);
      setRosters(rostersData);

      // Convert stats array to map by playerId
      const stats = new Map<string, PlayerStats>();
      statsData.forEach(stat => {
        stats.set(stat.playerId, stat);
      });
      setPlayerStats(stats);
    } catch (err) {
      setError('Failed to load scores');
      console.error('Error loading scores:', err);
    } finally {
      setLoading(false);
    }
  }, [week]);

  // Load data on mount and week change
  useEffect(() => {
    loadScoreData();
  }, [loadScoreData]);

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
  }, [users, rosters, playerStats, getPlayerById, week]);

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

// Multi-week standings data structure
export interface MultiWeekStanding {
  user: User;
  weeklyPoints: Record<PlayoffWeekName, number>;
  totalPoints: number;
}

// Get standings across all weeks with per-week breakdown
export function useMultiWeekStandings(
  getPlayerById: (id: string) => Player | undefined
): {
  standings: MultiWeekStanding[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [standings, setStandings] = useState<MultiWeekStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const users = await getAllUsers();
      const weeks: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];

      // Initialize standings for each user
      const userStandings = new Map<string, MultiWeekStanding>();
      for (const user of users) {
        userStandings.set(user.uid, {
          user,
          weeklyPoints: {
            wildcard: 0,
            divisional: 0,
            championship: 0,
            superbowl: 0,
          },
          totalPoints: 0,
        });
      }

      // Load data for each week
      for (let weekNum = 1; weekNum <= 4; weekNum++) {
        const weekName = PLAYOFF_WEEK_NAMES[weekNum] as PlayoffWeekName;

        const [rosters, statsData] = await Promise.all([
          getAllRostersForWeek(weekNum),
          getAllPlayerStatsForWeek(weekName),
        ]);

        // Convert stats to map
        const statsMap = new Map<string, PlayerStats>();
        statsData.forEach(stat => statsMap.set(stat.playerId, stat));

        // Calculate points for each roster
        for (const roster of rosters) {
          const standing = userStandings.get(roster.odId);
          if (!standing) continue;

          let weekPoints = 0;
          const slots = [
            roster.qb, roster.rb1, roster.rb2,
            roster.wr1, roster.wr2, roster.wr3,
            roster.te, roster.dst, roster.k,
          ];

          for (const playerId of slots) {
            if (!playerId) continue;
            const stats = statsMap.get(playerId);
            if (stats) {
              weekPoints += calculatePoints(stats);
            }
          }

          standing.weeklyPoints[weekName] = weekPoints;
          standing.totalPoints += weekPoints;
        }
      }

      // Convert to array and sort by total points
      const sortedStandings = Array.from(userStandings.values())
        .filter(s => s.totalPoints > 0 || Object.values(s.weeklyPoints).some(p => p > 0))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      setStandings(sortedStandings);
    } catch (err) {
      setError('Failed to load standings');
      console.error('Error loading multi-week standings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    standings,
    loading,
    error,
    refresh: loadAllData,
  };
}
