/**
 * Centralized configuration module.
 *
 * Import all configuration from this module:
 *
 *   import { PLAYOFF_WEEKS, WEEK_LOCK_TIMES, ADMIN_EMAILS } from '@/config';
 *
 * Or import from specific modules:
 *
 *   import { PLAYOFF_WEEKS } from '@/config/weeks';
 *   import { WEEK_LOCK_TIMES, GAME_RESULTS } from '@/config/season';
 */

// Week configuration (static, rarely changes)
export * from './weeks';

// Season configuration (changes each year)
export * from './season';
