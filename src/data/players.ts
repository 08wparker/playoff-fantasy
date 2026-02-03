/**
 * Player and roster utilities.
 *
 * Season-specific configuration (lock times, teams, CSV paths) has been moved to:
 * - src/config/season.ts
 *
 * Import season config directly from the config module when needed.
 */

import {
  INITIAL_PLAYOFF_TEAMS,
  WEEK_CSV_FILES as _WEEK_CSV_FILES,
  WEEK_LOCK_TIMES as _WEEK_LOCK_TIMES,
} from '../config/season';

// Re-export season config for backward compatibility
// TODO: Update imports in other files to use '@/config/season' directly
export const PLAYOFF_TEAMS = INITIAL_PLAYOFF_TEAMS;
export const WEEK_CSV_FILES = _WEEK_CSV_FILES;
export const WEEK_LOCK_TIMES = _WEEK_LOCK_TIMES;

// Check if roster is locked for a given week
export function isRosterLocked(week: number): boolean {
  const lockTime = _WEEK_LOCK_TIMES[week];
  if (!lockTime) return false;
  return new Date() >= lockTime;
}

// Get time remaining until lock
export function getTimeUntilLock(week: number): string {
  const lockTime = _WEEK_LOCK_TIMES[week];
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
  const lockTime = _WEEK_LOCK_TIMES[week];
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
