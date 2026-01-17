import type { NFLTeam } from '../types';

// 2024-2025 NFL Playoff Teams - Update this each week as teams are eliminated
export const PLAYOFF_TEAMS: NFLTeam[] = [
  // Teams from wildcard CSV
  'BUF', 'PHI', 'NE', 'LAR', 'JAX', 'CHI', 'GB', 'LAC', 'SF', 'HOU', 'PIT', 'CAR',
];

// CSV file paths for each week
export const WEEK_CSV_FILES: Record<number, string> = {
  1: '/data/wildcard.csv',
  2: '/data/divisional.csv',
  3: '/data/championship.csv',
  4: '/data/superbowl.csv',
};

// Lock times for each playoff week (when rosters can no longer be saved)
// Times are in UTC
export const WEEK_LOCK_TIMES: Record<number, Date> = {
  1: new Date('2026-01-10T21:30:00Z'), // Jan 10, 3:30 PM CST (Wild Card)
  2: new Date('2026-01-17T21:30:00Z'), // Jan 17, 2:30 PM MT (Divisional)
  3: new Date('2026-01-26T19:00:00Z'), // Jan 26, 1:00 PM CST (Conference)
  4: new Date('2026-02-09T00:30:00Z'), // Feb 8, 6:30 PM CST (Super Bowl)
};

// Check if roster is locked for a given week
export function isRosterLocked(week: number): boolean {
  const lockTime = WEEK_LOCK_TIMES[week];
  if (!lockTime) return false;
  return new Date() >= lockTime;
}

// Get time remaining until lock
export function getTimeUntilLock(week: number): string {
  const lockTime = WEEK_LOCK_TIMES[week];
  if (!lockTime) return '';

  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) return 'Locked';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h until lock`;
  if (hours > 0) return `${hours}h ${minutes}m until lock`;
  return `${minutes}m until lock`;
}

// Get formatted lock time for display
export function getLockTimeFormatted(week: number): string {
  const lockTime = WEEK_LOCK_TIMES[week];
  if (!lockTime) return '';

  return lockTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
