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

  // Kicking
  fieldGoal: number;
  extraPoint: number;

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

  // Kicking
  fieldGoal: 3,
  extraPoint: 1,

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
export function calculatePoints(stats: PlayerStats, rules: ScoringRules = PPR_SCORING): number {
  let points = 0;

  // Passing
  points += stats.passingYards / rules.passingYardsPerPoint;
  points += stats.passingTDs * rules.passingTD;
  points += stats.interceptions * rules.interception;

  // Rushing
  points += stats.rushingYards / rules.rushingYardsPerPoint;
  points += stats.rushingTDs * rules.rushingTD;

  // Receiving
  points += stats.receivingYards / rules.receivingYardsPerPoint;
  points += stats.receivingTDs * rules.receivingTD;
  points += stats.receptions * rules.reception;

  // Kicking
  points += stats.fieldGoals * rules.fieldGoal;
  points += stats.extraPoints * rules.extraPoint;

  // Defense
  points += getDefensePointsAllowedScore(stats.pointsAllowed, rules);
  points += stats.sacks * rules.sack;
  points += stats.defensiveInterceptions * rules.defensiveInterception;
  points += stats.fumbleRecoveries * rules.fumbleRecovery;
  points += stats.defensiveTDs * rules.defensiveTD;

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
  if (stats.fieldGoals > 0) {
    breakdown.push(`FGs: ${stats.fieldGoals} (${stats.fieldGoals * rules.fieldGoal} pts)`);
  }
  if (stats.extraPoints > 0) {
    breakdown.push(`XPs: ${stats.extraPoints} (${stats.extraPoints * rules.extraPoint} pts)`);
  }

  return breakdown;
}
