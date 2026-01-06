import type { PlayerStats } from '../types';

// PPR Scoring system
export interface ScoringRules {
  // Passing
  passingYardsPerPoint: number;  // yards per point (e.g., 25 = 1 point per 25 yards)
  passingTD: number;
  interception: number;

  // Rushing
  rushingYardsPerPoint: number;
  rushingTD: number;

  // Receiving
  receivingYardsPerPoint: number;
  receivingTD: number;
  reception: number;  // PPR

  // Kicking - Field Goals
  fg0_39: number;       // FG made 0-39 yards
  fg40_49: number;      // FG made 40-49 yards
  fg50Plus: number;     // FG made 50+ yards
  fgMissed: number;     // Missed/blocked FG
  // Kicking - Extra Points
  extraPoint: number;   // XP made
  xpMissed: number;     // XP missed

  // Defense
  shutout: number;           // 0 points allowed
  under7: number;            // 1-6 points allowed
  under14: number;           // 7-13 points allowed
  under21: number;           // 14-20 points allowed
  under28: number;           // 21-27 points allowed
  under35: number;           // 28-34 points allowed
  over35: number;            // 35+ points allowed
  sack: number;
  defensiveInterception: number;
  fumbleRecovery: number;
  defensiveTD: number;
}

// Standard PPR scoring rules
export const PPR_SCORING: ScoringRules = {
  // Passing
  passingYardsPerPoint: 25,   // 0.04 points per yard
  passingTD: 4,
  interception: -2,

  // Rushing
  rushingYardsPerPoint: 10,   // 0.1 points per yard
  rushingTD: 6,

  // Receiving
  receivingYardsPerPoint: 10, // 0.1 points per yard
  receivingTD: 6,
  reception: 1,               // PPR

  // Kicking - Field Goals
  fg0_39: 3,
  fg40_49: 4,
  fg50Plus: 5,
  fgMissed: -1,
  // Kicking - Extra Points
  extraPoint: 1,
  xpMissed: -1,

  // Defense
  shutout: 10,
  under7: 7,
  under14: 4,
  under21: 1,
  under28: 0,
  under35: -1,
  over35: -4,
  sack: 1,
  defensiveInterception: 2,
  fumbleRecovery: 2,
  defensiveTD: 6,
};

// Calculate points for a player's stats
// Position is optional - if provided, defensive scoring only applies to D/ST
export function calculatePoints(stats: PlayerStats, rules: ScoringRules = PPR_SCORING, position?: string): number {
  let points = 0;

  // Passing
  points += (stats.passingYards || 0) / rules.passingYardsPerPoint;
  points += (stats.passingTDs || 0) * rules.passingTD;
  points += (stats.interceptions || 0) * rules.interception;

  // Rushing
  points += (stats.rushingYards || 0) / rules.rushingYardsPerPoint;
  points += (stats.rushingTDs || 0) * rules.rushingTD;

  // Receiving
  points += (stats.receivingYards || 0) / rules.receivingYardsPerPoint;
  points += (stats.receivingTDs || 0) * rules.receivingTD;
  points += (stats.receptions || 0) * rules.reception;

  // Kicking - Field Goals
  points += (stats.fg0_39 || 0) * rules.fg0_39;
  points += (stats.fg40_49 || 0) * rules.fg40_49;
  points += (stats.fg50Plus || 0) * rules.fg50Plus;
  points += (stats.fgMissed || 0) * rules.fgMissed;
  // Kicking - Extra Points
  points += (stats.xpMade || 0) * rules.extraPoint;
  points += (stats.xpMissed || 0) * rules.xpMissed;

  // Defense - only apply to D/ST players
  const isDefense = !position || position === 'D/ST' || position === 'DST';
  if (isDefense) {
    // Only count points allowed if there are actual defensive stats or it's explicitly a D/ST
    const hasDefensiveActivity = (stats.sacks || 0) > 0 || (stats.defensiveInterceptions || 0) > 0 ||
                                  (stats.fumbleRecoveries || 0) > 0 || (stats.defensiveTDs || 0) > 0 ||
                                  position === 'D/ST' || position === 'DST';
    if (hasDefensiveActivity) {
      points += getDefensePointsAllowedScore(stats.pointsAllowed || 0, rules);
    }
    points += (stats.sacks || 0) * rules.sack;
    points += (stats.defensiveInterceptions || 0) * rules.defensiveInterception;
    points += (stats.fumbleRecoveries || 0) * rules.fumbleRecovery;
    points += (stats.defensiveTDs || 0) * rules.defensiveTD;
  }

  // Round to 2 decimal places
  return Math.round(points * 100) / 100;
}

// Calculate defensive points based on points allowed
function getDefensePointsAllowedScore(pointsAllowed: number, rules: ScoringRules): number {
  if (pointsAllowed === 0) return rules.shutout;
  if (pointsAllowed <= 6) return rules.under7;
  if (pointsAllowed <= 13) return rules.under14;
  if (pointsAllowed <= 20) return rules.under21;
  if (pointsAllowed <= 27) return rules.under28;
  if (pointsAllowed <= 34) return rules.under35;
  return rules.over35;
}

// Format points for display
export function formatPoints(points: number): string {
  return points.toFixed(2);
}

// Get scoring breakdown for a player (for tooltips/details)
export function getScoringBreakdown(stats: PlayerStats, rules: ScoringRules = PPR_SCORING): string[] {
  const breakdown: string[] = [];

  if (stats.passingYards > 0) {
    breakdown.push(`Passing: ${stats.passingYards} yds (${(stats.passingYards / rules.passingYardsPerPoint).toFixed(1)} pts)`);
  }
  if (stats.passingTDs > 0) {
    breakdown.push(`Passing TDs: ${stats.passingTDs} (${stats.passingTDs * rules.passingTD} pts)`);
  }
  if (stats.interceptions > 0) {
    breakdown.push(`INTs: ${stats.interceptions} (${stats.interceptions * rules.interception} pts)`);
  }
  if (stats.rushingYards > 0) {
    breakdown.push(`Rushing: ${stats.rushingYards} yds (${(stats.rushingYards / rules.rushingYardsPerPoint).toFixed(1)} pts)`);
  }
  if (stats.rushingTDs > 0) {
    breakdown.push(`Rushing TDs: ${stats.rushingTDs} (${stats.rushingTDs * rules.rushingTD} pts)`);
  }
  if (stats.receptions > 0) {
    breakdown.push(`Receptions: ${stats.receptions} (${stats.receptions * rules.reception} pts)`);
  }
  if (stats.receivingYards > 0) {
    breakdown.push(`Receiving: ${stats.receivingYards} yds (${(stats.receivingYards / rules.receivingYardsPerPoint).toFixed(1)} pts)`);
  }
  if (stats.receivingTDs > 0) {
    breakdown.push(`Receiving TDs: ${stats.receivingTDs} (${stats.receivingTDs * rules.receivingTD} pts)`);
  }
  if (stats.fg0_39 > 0) {
    breakdown.push(`FG 0-39: ${stats.fg0_39} (${stats.fg0_39 * rules.fg0_39} pts)`);
  }
  if (stats.fg40_49 > 0) {
    breakdown.push(`FG 40-49: ${stats.fg40_49} (${stats.fg40_49 * rules.fg40_49} pts)`);
  }
  if (stats.fg50Plus > 0) {
    breakdown.push(`FG 50+: ${stats.fg50Plus} (${stats.fg50Plus * rules.fg50Plus} pts)`);
  }
  if (stats.fgMissed > 0) {
    breakdown.push(`FG Missed: ${stats.fgMissed} (${stats.fgMissed * rules.fgMissed} pts)`);
  }
  if (stats.xpMade > 0) {
    breakdown.push(`XP Made: ${stats.xpMade} (${stats.xpMade * rules.extraPoint} pts)`);
  }
  if (stats.xpMissed > 0) {
    breakdown.push(`XP Missed: ${stats.xpMissed} (${stats.xpMissed * rules.xpMissed} pts)`);
  }

  return breakdown;
}
