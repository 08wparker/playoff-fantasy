/**
 * Centralized week configuration - Single source of truth for all playoff week definitions.
 *
 * This file consolidates week mappings that were previously scattered across:
 * - src/types/index.ts (PLAYOFF_WEEK_NAMES, PLAYOFF_WEEK_DISPLAY_NAMES)
 * - src/components/admin/AdminSync.tsx
 * - src/components/admin/AdminWeek.tsx
 * - src/components/analysis/Analysis.tsx
 * - src/components/scoring/WeeklyPlayerStats.tsx
 */

import type { PlayoffWeekName } from '../types';

export interface WeekConfig {
  number: number;
  name: PlayoffWeekName;
  label: string;
  shortLabel: string;
}

/**
 * Master list of all playoff weeks.
 * This is the ONLY place week definitions should be maintained.
 */
export const PLAYOFF_WEEKS: WeekConfig[] = [
  { number: 1, name: 'wildcard', label: 'Wild Card', shortLabel: 'WC' },
  { number: 2, name: 'divisional', label: 'Divisional', shortLabel: 'DIV' },
  { number: 3, name: 'championship', label: 'Conference Championships', shortLabel: 'CONF' },
  { number: 4, name: 'superbowl', label: 'Super Bowl', shortLabel: 'SB' },
];

// Derived constants for backward compatibility
export const WEEK_NUMBERS: Record<PlayoffWeekName, number> = {
  wildcard: 1,
  divisional: 2,
  championship: 3,
  superbowl: 4,
};

export const WEEK_NAMES: Record<number, PlayoffWeekName> = {
  1: 'wildcard',
  2: 'divisional',
  3: 'championship',
  4: 'superbowl',
};

export const WEEK_LABELS: Record<PlayoffWeekName, string> = {
  wildcard: 'Wild Card',
  divisional: 'Divisional',
  championship: 'Conference Championships',
  superbowl: 'Super Bowl',
};

// Helper functions
export function getWeekByNumber(num: number): WeekConfig | undefined {
  return PLAYOFF_WEEKS.find(w => w.number === num);
}

export function getWeekByName(name: PlayoffWeekName): WeekConfig | undefined {
  return PLAYOFF_WEEKS.find(w => w.name === name);
}

export function weekNumberToName(num: number): PlayoffWeekName {
  return getWeekByNumber(num)?.name ?? 'wildcard';
}

export function weekNameToNumber(name: PlayoffWeekName): number {
  return getWeekByName(name)?.number ?? 1;
}

/**
 * Get all weeks up to and including the specified week number.
 * Useful for displaying completed weeks or weeks available for stats.
 */
export function getWeeksUpTo(weekNumber: number): WeekConfig[] {
  return PLAYOFF_WEEKS.filter(w => w.number <= weekNumber);
}

/**
 * Get weeks that have been completed (before the current week).
 */
export function getCompletedWeeks(currentWeek: number): WeekConfig[] {
  return PLAYOFF_WEEKS.filter(w => w.number < currentWeek);
}

/**
 * Get array of week configs for use in dropdowns/selectors.
 */
export function getWeekOptions(includeSuperbowl = true): { value: number; label: string }[] {
  return PLAYOFF_WEEKS
    .filter(w => includeSuperbowl || w.name !== 'superbowl')
    .map(w => ({ value: w.number, label: w.label }));
}
