import { useState, useEffect } from 'react';
import type { ScoringRules } from '../../services/scoring';
import { PPR_SCORING } from '../../services/scoring';
import { subscribeToScoringRules } from '../../services/firebase';

export function ScoringRubric() {
  const [rules, setRules] = useState<ScoringRules>(PPR_SCORING);
  const [expanded, setExpanded] = useState(false);

  // Subscribe to real-time scoring rules updates
  useEffect(() => {
    const unsubscribe = subscribeToScoringRules(setRules);
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
      >
        <h3 className="font-semibold text-gray-800">Scoring Rubric</h3>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Passing */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Passing</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="Passing Yards" value={`1 pt per ${rules.passingYardsPerPoint} yds`} />
              <RubricRow label="Passing TD" value={`${rules.passingTD} pts`} />
              <RubricRow label="Interception" value={`${rules.interception} pts`} negative={rules.interception < 0} />
            </div>
          </div>

          {/* Rushing */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Rushing</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="Rushing Yards" value={`1 pt per ${rules.rushingYardsPerPoint} yds`} />
              <RubricRow label="Rushing TD" value={`${rules.rushingTD} pts`} />
            </div>
          </div>

          {/* Receiving */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Receiving</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="Reception (PPR)" value={`${rules.reception} pts`} highlight />
              <RubricRow label="Receiving Yards" value={`1 pt per ${rules.receivingYardsPerPoint} yds`} />
              <RubricRow label="Receiving TD" value={`${rules.receivingTD} pts`} />
            </div>
          </div>

          {/* Field Goals */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Field Goals</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="FG 0-39 yards" value={`${rules.fg0_39} pts`} />
              <RubricRow label="FG 40-49 yards" value={`${rules.fg40_49} pts`} />
              <RubricRow label="FG 50+ yards" value={`${rules.fg50Plus} pts`} />
              <RubricRow label="FG Missed" value={`${rules.fgMissed} pts`} negative={rules.fgMissed < 0} />
            </div>
          </div>

          {/* Extra Points */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Extra Points</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="XP Made" value={`${rules.extraPoint} pts`} />
              <RubricRow label="XP Missed" value={`${rules.xpMissed} pts`} negative={rules.xpMissed < 0} />
            </div>
          </div>

          {/* Defense - Points Allowed */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Defense - Points Allowed</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="Shutout (0 pts)" value={`${rules.shutout} pts`} />
              <RubricRow label="1-6 Points" value={`${rules.under7} pts`} />
              <RubricRow label="7-13 Points" value={`${rules.under14} pts`} />
              <RubricRow label="14-20 Points" value={`${rules.under21} pts`} />
              <RubricRow label="21-27 Points" value={`${rules.under28} pts`} />
              <RubricRow label="28-34 Points" value={`${rules.under35} pts`} negative={rules.under35 < 0} />
              <RubricRow label="35+ Points" value={`${rules.over35} pts`} negative={rules.over35 < 0} />
            </div>
          </div>

          {/* Defense - Plays */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Defense - Plays</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <RubricRow label="Sack" value={`${rules.sack} pts`} />
              <RubricRow label="Interception" value={`${rules.defensiveInterception} pts`} />
              <RubricRow label="Fumble Recovery" value={`${rules.fumbleRecovery} pts`} />
              <RubricRow label="Defensive TD" value={`${rules.defensiveTD} pts`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual rubric row component
function RubricRow({
  label,
  value,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1 px-2 bg-white rounded border border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span
        className={`font-medium ${
          negative ? 'text-red-600' : highlight ? 'text-primary-600' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
